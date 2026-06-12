/**
 * Kubernetes AI Conformance run orchestrator.
 *
 * Selects checklist, evaluates requirements, and persists outcomes.
 * Run-level failures are persisted without throwing through the operator loop.
 */

import { randomUUID } from 'crypto';
import type { Logger } from 'winston';
import type { KubernetesClient } from '../kubernetes/client.js';
import { AiConformanceRepository } from '../database/ai-conformance-repository.js';
import type { AiConformanceRunRecord } from '../database/ai-conformance-contracts.js';
import {
  ChecklistLoadError,
  boundChecklistErrorDetail,
} from './checklist/errors.js';
import { selectChecklistForCluster } from './checklist/selector.js';
import type { ChecklistSelectionInput } from './checklist/selector.js';
import { evaluateChecklistRequirements } from './evaluator.js';
import {
  boundConformanceText,
  CONFORMANCE_FAILURE_REASON_MAX,
  type AiConformanceRunState,
  type EvaluatedRequirementResult,
} from './contracts.js';
import { buildTotalsFromResults } from './summary.js';

export interface AiConformanceRunInput {
  runId?: string;
  selection: ChecklistSelectionInput;
}

export interface AiConformanceRunnerDeps {
  kubernetes: KubernetesClient;
  logger?: Logger;
  storage?: AiConformanceRepository;
}

function countByLevel(requirements: { level: string }[]): {
  must: number;
  should: number;
} {
  let must = 0;
  let should = 0;
  for (const req of requirements) {
    if (req.level === 'MUST') {
      must++;
    } else {
      should++;
    }
  }
  return { must, should };
}

function buildFailedRunRecord(params: {
  runId: string;
  checklistVersion: string;
  kubernetesMinor: string;
  sourceRevision: string | null;
  requestedAt: string;
  totalRequirements: number;
  mustRequirements: number;
  shouldRequirements: number;
  failureReason: string;
}): AiConformanceRunRecord {
  return {
    run_id: params.runId,
    checklist_version: params.checklistVersion,
    kubernetes_minor: params.kubernetesMinor,
    source_revision: params.sourceRevision,
    state: 'failed',
    requested_at: params.requestedAt,
    started_at: params.requestedAt,
    completed_at: new Date().toISOString(),
    total_requirements: params.totalRequirements,
    must_requirements: params.mustRequirements,
    should_requirements: params.shouldRequirements,
    passed_count: 0,
    failed_count: 0,
    warning_count: 0,
    not_applicable_count: 0,
    not_evaluated_count: 0,
    needs_evidence_count: 0,
    failure_reason: boundConformanceText(params.failureReason, CONFORMANCE_FAILURE_REASON_MAX),
  };
}

function computeRunState(results: EvaluatedRequirementResult[]): AiConformanceRunState {
  const hasNotEvaluated = results.some((r) => r.status === 'not-evaluated');
  if (hasNotEvaluated) {
    return 'partial';
  }
  return 'completed';
}

/**
 * Orchestrates checklist selection, evaluation, and persistence.
 */
export class AiConformanceRunner {
  private readonly deps: AiConformanceRunnerDeps;
  private readonly storage: AiConformanceRepository;

  constructor(deps: AiConformanceRunnerDeps) {
    this.deps = deps;
    this.storage = deps.storage ?? new AiConformanceRepository();
  }

  /**
   * Execute a conformance run. Does not throw on evaluation failures.
   */
  async run(input: AiConformanceRunInput): Promise<AiConformanceRunRecord> {
    const runId = input.runId ?? randomUUID();
    const requestedAt = new Date().toISOString();

    try {
      const loaded = selectChecklistForCluster(input.selection);
      const requirements = loaded.document.requirements;
      const levelCounts = countByLevel(requirements);
      const startedAt = new Date().toISOString();

      const evaluationResults = await evaluateChecklistRequirements(requirements, {
        kubernetes: this.deps.kubernetes,
        logger: this.deps.logger,
      });

      const totals = buildTotalsFromResults(requirements, evaluationResults);
      const finalState = computeRunState(evaluationResults);

      const runRecord: AiConformanceRunRecord = {
        run_id: runId,
        checklist_version: loaded.metadata.checklistVersion,
        kubernetes_minor: loaded.metadata.kubernetesMinor,
        source_revision: loaded.metadata.sourceRevision,
        state: finalState,
        requested_at: requestedAt,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        total_requirements: totals.totalRequirements,
        must_requirements: totals.mustRequirements,
        should_requirements: totals.shouldRequirements,
        passed_count: totals.passed,
        failed_count: totals.failed,
        warning_count: totals.warning,
        not_applicable_count: totals.notApplicable,
        not_evaluated_count: totals.notEvaluated,
        needs_evidence_count: totals.needsEvidence,
        failure_reason: null,
      };

      this.storage.upsertRun(runRecord);
      this.storage.insertRequirementResults(runId, evaluationResults);
      return runRecord;
    } catch (err) {
      const failureReason =
        err instanceof ChecklistLoadError
          ? boundChecklistErrorDetail(err)
          : boundConformanceText(
              err instanceof Error ? err.message : String(err),
              CONFORMANCE_FAILURE_REASON_MAX
            );

      let kubernetesMinor = 'unknown';
      let checklistVersion = 'unknown';
      let sourceRevision: string | null = null;

      if (err instanceof ChecklistLoadError && err.kubernetesMinor) {
        kubernetesMinor = err.kubernetesMinor;
        checklistVersion = `KubernetesAIConformance-${kubernetesMinor}`;
      }

      const failedRecord = buildFailedRunRecord({
        runId,
        checklistVersion,
        kubernetesMinor,
        sourceRevision,
        requestedAt,
        totalRequirements: 0,
        mustRequirements: 0,
        shouldRequirements: 0,
        failureReason,
      });

      this.deps.logger?.error?.('AI conformance run failed', {
        runId,
        error: failureReason,
      });

      try {
        this.storage.upsertRun(failedRecord);
      } catch (persistErr) {
        this.deps.logger?.error?.('Failed to persist failed conformance run', {
          runId,
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        });
      }

      return failedRecord;
    }
  }
}
