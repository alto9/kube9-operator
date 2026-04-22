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
import type { TrivyStatus } from '../status/types.js';
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
}

let lastRunSnapshot: ScheduledAssessmentLastRunSnapshot | null = null;

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
