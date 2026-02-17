/**
 * Assessment Runner - Executes checks, handles errors/timeouts, records outcomes
 *
 * Orchestrates assessment runs: resolves checks by selection mode,
 * executes with per-check timeout and exception isolation,
 * persists outcomes through storage API, and aggregates final summary.
 */

import { randomUUID } from 'crypto';
import type { AssessmentCheck } from './types.js';
import {
  Pillar,
  CheckStatus,
  AssessmentRunMode,
  AssessmentRunState,
  type AssessmentRunContext,
  type AssessmentCheckResult as TypesCheckResult,
} from './types.js';
import { getRegistry } from './registry.js';
import { AssessmentRepository } from '../database/assessment-repository.js';
import type {
  AssessmentRunRecord,
  AssessmentCheckResult as StorageCheckResult,
  AssessmentLifecycleState,
} from './contracts.js';
import {
  AssessmentRunModeSchema,
  AssessmentLifecycleStateSchema,
} from './contracts.js';
import type { Config } from '../config/types.js';
import type { KubernetesClient } from '../kubernetes/client.js';
import type { Logger } from 'winston';

/** Default per-check timeout in milliseconds */
const DEFAULT_CHECK_TIMEOUT_MS = 30_000;

/** Input for starting an assessment run */
export interface AssessmentRunInput {
  /** Run identifier (uses request_id or generates UUID) */
  runId?: string;
  /** Selection mode */
  mode: AssessmentRunMode;
  /** Pillar filter when mode is 'pillar' */
  pillarFilter?: Pillar;
  /** Check ID filter when mode is 'single-check' */
  checkIdFilter?: string;
  /** Per-check timeout in milliseconds */
  timeoutMs?: number;
}

/** Dependencies for the runner */
export interface AssessmentRunnerDeps {
  kubernetes: KubernetesClient;
  config: Config;
  logger: Logger;
  storage?: AssessmentRepository;
}

/**
 * Resolve checks from registry based on selection mode.
 * Returns checks in deterministic order (by id).
 */
export function resolveChecksForRun(input: AssessmentRunInput): AssessmentCheck[] {
  const registry = getRegistry();

  switch (input.mode) {
    case AssessmentRunMode.Full:
      return registry.getAllChecks();
    case AssessmentRunMode.Pillar:
      if (!input.pillarFilter) {
        return [];
      }
      return registry.getByPillar(input.pillarFilter);
    case AssessmentRunMode.SingleCheck:
      if (!input.checkIdFilter) {
        return [];
      }
      const check = registry.getById(input.checkIdFilter);
      return check ? [check] : [];
    default:
      return [];
  }
}

/**
 * Convert types.AssessmentCheckResult to storage format.
 * Ensures message is non-empty (required by schema).
 */
function toStorageResult(
  result: TypesCheckResult,
  runId: string,
  assessedAt: string
): StorageCheckResult {
  return {
    run_id: runId,
    check_id: result.checkId,
    pillar: result.pillar,
    status: result.status,
    message: result.message && result.message.trim().length > 0
      ? result.message
      : 'No message',
    remediation: result.remediation,
    duration_ms: result.durationMs ?? 0,
    assessed_at: assessedAt,
    error_code: result.errorCode,
  };
}

/**
 * Run a single check with timeout and exception isolation.
 * Never throws - returns error/timeout result on failure.
 */
async function runCheckWithIsolation(
  check: AssessmentCheck,
  ctx: AssessmentRunContext
): Promise<TypesCheckResult> {
  const start = Date.now();
  const timeoutMs = ctx.timeoutMs;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('CHECK_TIMEOUT')), timeoutMs);
  });

  try {
    const runPromise = check.run(ctx);
    const result = await Promise.race([runPromise, timeoutPromise]);
    const durationMs = Date.now() - start;
    return { ...result, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const isTimeout = err instanceof Error && err.message === 'CHECK_TIMEOUT';
    return {
      checkId: check.id,
      checkName: check.name,
      pillar: check.pillar,
      status: isTimeout ? CheckStatus.Timeout : CheckStatus.Error,
      message: err instanceof Error ? err.message : String(err),
      durationMs,
      errorCode: isTimeout ? 'CHECK_TIMEOUT' : 'CHECK_ERROR',
    };
  }
}

/**
 * Determine final run state from counts.
 */
function computeFinalState(
  total: number,
  completed: number,
  passed: number,
  failed: number,
  warning: number,
  error: number,
  timeout: number
): AssessmentRunState {
  if (completed < total) {
    return AssessmentRunState.Partial;
  }
  if (error > 0 || timeout > 0) {
    return failed > 0 || warning > 0 ? AssessmentRunState.Partial : AssessmentRunState.Completed;
  }
  if (failed > 0 || warning > 0) {
    return AssessmentRunState.Completed;
  }
  return AssessmentRunState.Completed;
}

/**
 * AssessmentRunner orchestrates check execution with persistence.
 */
export class AssessmentRunner {
  private readonly deps: AssessmentRunnerDeps;
  private readonly storage: AssessmentRepository;

  constructor(deps: AssessmentRunnerDeps) {
    this.deps = deps;
    this.storage = deps.storage ?? new AssessmentRepository();
  }

  /**
   * Execute an assessment run.
   * Does not throw on check failures - isolates errors and records outcomes.
   */
  async run(input: AssessmentRunInput): Promise<AssessmentRunRecord> {
    const runId = input.runId ?? randomUUID();
    const timeoutMs = input.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
    const requestedAt = new Date().toISOString();

    const checks = resolveChecksForRun(input);
    const totalChecks = checks.length;

    const ctx: AssessmentRunContext = {
      kubernetes: this.deps.kubernetes,
      config: this.deps.config,
      logger: this.deps.logger,
      timeoutMs,
      runId,
      mode: input.mode,
      pillarFilter: input.pillarFilter,
      checkIdFilter: input.checkIdFilter,
    };

    // Initial record (queued -> running)
    const initialRecord: AssessmentRunRecord = {
      run_id: runId,
      mode: AssessmentRunModeSchema.parse(input.mode),
      state: 'queued',
      requested_at: requestedAt,
      total_checks: totalChecks,
      completed_checks: 0,
      passed_checks: 0,
      failed_checks: 0,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    };
    this.storage.upsertAssessment(initialRecord);

    const runningRecord: AssessmentRunRecord = {
      ...initialRecord,
      state: 'running',
      started_at: new Date().toISOString(),
    };
    this.storage.upsertAssessment(runningRecord);

    let passed = 0;
    let failed = 0;
    let warning = 0;
    let skipped = 0;
    let error = 0;
    let timeout = 0;

    for (const check of checks) {
      const result = await runCheckWithIsolation(check, ctx);
      const assessedAt = new Date().toISOString();

      switch (result.status) {
        case CheckStatus.Passing:
          passed++;
          break;
        case CheckStatus.Failing:
          failed++;
          break;
        case CheckStatus.Warning:
          warning++;
          break;
        case CheckStatus.Skipped:
          skipped++;
          break;
        case CheckStatus.Error:
          error++;
          break;
        case CheckStatus.Timeout:
          timeout++;
          break;
      }

      const storageResult = toStorageResult(result, runId, assessedAt);
      const historyId = `${runId}-${check.id}-${Date.now()}`;
      this.storage.insertCheckResult(storageResult, historyId, result.checkName ?? check.name);
    }

    const completedChecks = passed + failed + warning + skipped + error + timeout;
    const finalState = computeFinalState(
      totalChecks,
      completedChecks,
      passed,
      failed,
      warning,
      error,
      timeout
    );

    const finalRecord: AssessmentRunRecord = {
      run_id: runId,
      mode: AssessmentRunModeSchema.parse(input.mode),
      state: AssessmentLifecycleStateSchema.parse(finalState) as AssessmentLifecycleState,
      requested_at: requestedAt,
      started_at: runningRecord.started_at,
      completed_at: new Date().toISOString(),
      total_checks: totalChecks,
      completed_checks: completedChecks,
      passed_checks: passed,
      failed_checks: failed,
      warning_checks: warning,
      skipped_checks: skipped,
      error_checks: error,
      timeout_checks: timeout,
    };
    this.storage.upsertAssessment(finalRecord);

    return finalRecord;
  }
}
