/**
 * Periodic scheduled Kubernetes AI Conformance evaluation (operator CollectionScheduler task).
 */

import type { Config } from '../config/types.js';
import type { KubernetesClient } from '../kubernetes/client.js';
import type { Logger } from 'winston';
import { AiConformanceRunner } from './runner.js';
import { AiConformanceRepository } from '../database/ai-conformance-repository.js';

export type ScheduledAiConformanceRunOutcome = 'success' | 'failed';

export interface ScheduledAiConformanceLastRunSnapshot {
  startedAt: string;
  completedAt: string;
  outcome: ScheduledAiConformanceRunOutcome;
  runId?: string;
  runState?: string;
  errorMessage?: string;
}

let lastRunSnapshot: ScheduledAiConformanceLastRunSnapshot | null = null;

/** @internal */
export function resetScheduledAiConformanceStateForTests(): void {
  lastRunSnapshot = null;
}

export function getScheduledAiConformanceLastRunSnapshot(): ScheduledAiConformanceLastRunSnapshot | null {
  return lastRunSnapshot;
}

export interface ScheduledAiConformanceTickDeps {
  kubernetes: KubernetesClient;
  config: Config;
  logger: Logger;
}

/**
 * Executes one scheduled conformance run. Swallows errors so scheduler callbacks never throw.
 */
export async function runScheduledAiConformanceTick(
  deps: ScheduledAiConformanceTickDeps
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const clusterInfo = await deps.kubernetes.getClusterInfo();
    const storage = new AiConformanceRepository();
    const runner = new AiConformanceRunner({
      kubernetes: deps.kubernetes,
      logger: deps.logger,
      storage,
    });

    const record = await runner.run({
      selection: {
        gitVersion: clusterInfo.version,
      },
    });

    const outcome: ScheduledAiConformanceRunOutcome =
      record.state === 'failed' ? 'failed' : 'success';

    lastRunSnapshot = {
      startedAt,
      completedAt: record.completed_at ?? new Date().toISOString(),
      outcome,
      runId: record.run_id,
      runState: record.state,
      ...(record.state === 'failed' && record.failure_reason
        ? { errorMessage: record.failure_reason }
        : {}),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    deps.logger.error('Scheduled AI conformance tick failed', { error: errorMessage });
    lastRunSnapshot = {
      startedAt,
      completedAt: new Date().toISOString(),
      outcome: 'failed',
      errorMessage,
    };
  }
}
