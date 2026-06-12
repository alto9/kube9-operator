import type { AiConformanceLatestSummary } from '../ai-conformance/contracts.js';
import type { Config } from '../config/types.js';
import { AiConformanceRepository } from '../database/ai-conformance-repository.js';
import type { AiConformanceSummary } from './types.js';

/** Operator schedule fields published alongside conformance run summaries. */
export interface AiConformanceScheduleStatusContext {
  schedulingEnabled: boolean;
  scheduleIntervalSeconds: number | null;
  checklistSource: string | null;
}

export const DEFAULT_AI_CONFORMANCE_SCHEDULE_CONTEXT: AiConformanceScheduleStatusContext = {
  schedulingEnabled: false,
  scheduleIntervalSeconds: null,
  checklistSource: null,
};

const ZERO_TOTALS: AiConformanceSummary['totals'] = {
  totalRequirements: 0,
  mustRequirements: 0,
  shouldRequirements: 0,
  passed: 0,
  failed: 0,
  warning: 0,
  notApplicable: 0,
  notEvaluated: 0,
  needsEvidence: 0,
};

/**
 * Default conformance summary before the first persisted run exists.
 */
export const DEFAULT_AI_CONFORMANCE_SUMMARY: AiConformanceSummary = {
  checklistVersion: 'unknown',
  kubernetesMinor: 'unknown',
  sourceRevision: null,
  lastCompletedAt: null,
  lastOutcome: 'none',
  runState: null,
  runId: null,
  totals: { ...ZERO_TOTALS },
  categories: {},
  requirements: [],
  error: null,
  ...DEFAULT_AI_CONFORMANCE_SCHEDULE_CONTEXT,
};

/**
 * Derives published schedule fields from loaded operator configuration.
 */
export function buildAiConformanceScheduleContextFromConfig(
  config: Config
): AiConformanceScheduleStatusContext {
  return {
    schedulingEnabled: config.aiConformanceEnabled,
    scheduleIntervalSeconds: config.aiConformanceEnabled
      ? config.aiConformanceIntervalSeconds
      : null,
    checklistSource: config.aiConformanceChecklistSource,
  };
}

function cloneSummary(summary: AiConformanceLatestSummary): AiConformanceLatestSummary {
  return {
    ...summary,
    totals: { ...summary.totals },
    categories: Object.fromEntries(
      Object.entries(summary.categories).map(([key, value]) => [key, { ...value }])
    ),
    requirements: summary.requirements.map((row) => ({ ...row })),
  };
}

/**
 * Maps persisted repository summary and schedule context into the status payload.
 */
export function buildAiConformanceStatusSummary(
  latest: AiConformanceLatestSummary,
  schedule: AiConformanceScheduleStatusContext = DEFAULT_AI_CONFORMANCE_SCHEDULE_CONTEXT
): AiConformanceSummary {
  const persisted = cloneSummary(latest);
  return {
    checklistVersion: persisted.checklistVersion,
    kubernetesMinor: persisted.kubernetesMinor,
    sourceRevision: persisted.sourceRevision,
    lastCompletedAt: persisted.lastCompletedAt,
    lastOutcome: persisted.lastOutcome,
    runState: persisted.runState,
    runId: persisted.runId,
    totals: { ...persisted.totals },
    categories: persisted.categories,
    requirements: persisted.requirements.map((row) => ({ ...row })),
    error: persisted.error,
    schedulingEnabled: schedule.schedulingEnabled,
    scheduleIntervalSeconds: schedule.scheduleIntervalSeconds,
    checklistSource: schedule.checklistSource,
  };
}

/**
 * Loads the latest persisted conformance summary from SQLite.
 */
export function loadLatestPersistedAiConformanceSummary(
  repo: AiConformanceRepository
): AiConformanceLatestSummary {
  return repo.buildLatestSummary();
}
