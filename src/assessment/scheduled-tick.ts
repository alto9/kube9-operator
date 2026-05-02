/**
 * Periodic scheduled assessment execution (operator CollectionScheduler task).
 *
 * On each tick: ensures the global check registry is bootstrapped, runs {@link AssessmentRunner}
 * with the same persistence stack as `assess run` ({@link AssessmentRepository},
 * {@link ImageScanRepository} via runner defaults), and records a lightweight in-memory
 * snapshot for status consumers.
 */

import type { Config } from '../config/types.js';
import type { KubernetesClient } from '../kubernetes/client.js';
import type { Logger } from 'winston';
import type { AssessmentCheckStatusSummary, TrivyStatus } from '../status/types.js';
import { AssessmentRunner } from './runner.js';
import { bootstrapAssessmentRegistry } from './bootstrap.js';
import { getRegistry } from './registry.js';
import { AssessmentRunMode, isPillar, type Pillar } from './types.js';
import { AssessmentRepository } from '../database/assessment-repository.js';
import { ImageScanRepository } from '../database/image-scan-repository.js';

export type ScheduledAssessmentRunOutcome = 'success' | 'failed';

/** Last completed scheduled tick; safe to read from the Node main thread between ticks. */
export interface ScheduledAssessmentLastRunSnapshot {
  startedAt: string;
  completedAt: string;
  outcome: ScheduledAssessmentRunOutcome;
  runId?: string;
  state?: string;
  totalChecks?: number;
  completedChecks?: number;
  passedChecks?: number;
  failedChecks?: number;
  warningChecks?: number;
  errorMessage?: string;
  /** Present after a successful tick with persisted per-check rows */
  checkSummaries?: AssessmentCheckStatusSummary[];
}

let lastRunSnapshot: ScheduledAssessmentLastRunSnapshot | null = null;

function collectCheckSummariesFromRun(
  storage: AssessmentRepository,
  runId: string
): AssessmentCheckStatusSummary[] {
  const rows = storage.queryHistory({ filters: { run_id: runId }, limit: 512 });
  const byCheckId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!byCheckId.has(row.check_id)) {
      byCheckId.set(row.check_id, row);
    }
  }
  const summaries: AssessmentCheckStatusSummary[] = Array.from(byCheckId.values()).map((row) => ({
    checkId: row.check_id,
    checkName: row.check_name ?? row.check_id,
    pillar: row.pillar,
    status: row.status,
  }));
  summaries.sort((a, b) => {
    const byPillar = a.pillar.localeCompare(b.pillar);
    if (byPillar !== 0) {
      return byPillar;
    }
    return a.checkName.localeCompare(b.checkName);
  });
  return summaries;
}

/** @internal */
export function resetScheduledAssessmentStateForTests(): void {
  lastRunSnapshot = null;
}

export function getScheduledAssessmentLastRunSnapshot(): ScheduledAssessmentLastRunSnapshot | null {
  return lastRunSnapshot;
}

/**
 * Idempotent registry wiring: bootstraps built-in checks when the registry is empty.
 */
export function ensureAssessmentRegistryBootstrapped(): void {
  if (getRegistry().size === 0) {
    bootstrapAssessmentRegistry();
  }
}

function mapConfigModeToRunInput(config: Config): {
  mode: AssessmentRunMode;
  pillarFilter?: Pillar;
} {
  switch (config.assessmentMode) {
    case 'full':
      return { mode: AssessmentRunMode.Full };
    case 'pillar': {
      const raw = config.assessmentPillar;
      if (!raw || !isPillar(raw)) {
        throw new Error(
          'assessmentPillar must be set to a valid pillar when assessmentMode is "pillar"'
        );
      }
      return { mode: AssessmentRunMode.Pillar, pillarFilter: raw };
    }
    default:
      throw new Error(`Unsupported scheduled assessment mode: ${String(config.assessmentMode)}`);
  }
}

export interface ScheduledAssessmentTickDeps {
  kubernetes: KubernetesClient;
  config: Config;
  logger: Logger;
  getTrivyStatus?: () => TrivyStatus;
}

/**
 * Executes one scheduled assessment run. Swallows errors so scheduler callbacks never throw.
 */
export async function runScheduledAssessmentTick(deps: ScheduledAssessmentTickDeps): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    ensureAssessmentRegistryBootstrapped();

    const { mode, pillarFilter } = mapConfigModeToRunInput(deps.config);
    const timeoutMs =
      deps.config.assessmentTimeoutSeconds !== undefined
        ? deps.config.assessmentTimeoutSeconds * 1000
        : undefined;

    const storage = new AssessmentRepository();
    const imageScanRepository = new ImageScanRepository();
    const runner = new AssessmentRunner({
      kubernetes: deps.kubernetes,
      config: deps.config,
      logger: deps.logger,
      storage,
      getTrivyStatus: deps.getTrivyStatus,
      imageScanRepository,
    });

    const record = await runner.run({
      mode,
      pillarFilter,
      timeoutMs,
    });

    const checkSummaries = collectCheckSummariesFromRun(storage, record.run_id);

    lastRunSnapshot = {
      startedAt,
      completedAt: new Date().toISOString(),
      outcome: 'success',
      runId: record.run_id,
      state: record.state,
      totalChecks: record.total_checks,
      completedChecks: record.completed_checks,
      passedChecks: record.passed_checks,
      failedChecks: record.failed_checks,
      warningChecks: record.warning_checks,
      checkSummaries,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    deps.logger.error('Scheduled assessment tick failed', { error: errorMessage });
    lastRunSnapshot = {
      startedAt,
      completedAt: new Date().toISOString(),
      outcome: 'failed',
      errorMessage,
    };
  }
}
