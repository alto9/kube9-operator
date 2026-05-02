import type { ScheduledAssessmentLastRunSnapshot } from '../assessment/scheduled-tick.js';
import type { Config } from '../config/types.js';
import type { AssessmentCheckStatusSummary, AssessmentStatusSummary } from './types.js';

const MAX_ASSESSMENT_ERROR_SUMMARY = 200;

/** Operator assessment schedule fields published alongside run summaries. */
export interface AssessmentScheduleStatusContext {
  schedulingEnabled: boolean;
  scheduleIntervalSeconds: number | null;
  scheduledAssessmentMode: 'full' | 'pillar' | null;
  scheduledAssessmentPillar: string | null;
}

export const DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT: AssessmentScheduleStatusContext = {
  schedulingEnabled: false,
  scheduleIntervalSeconds: null,
  scheduledAssessmentMode: null,
  scheduledAssessmentPillar: null,
};

/**
 * Default assessment summary before any scheduled tick has completed in-process.
 */
export const DEFAULT_ASSESSMENT_STATUS_SUMMARY: AssessmentStatusSummary = {
  lastScheduledCompletedAt: null,
  lastScheduledOutcome: 'none',
  lastScheduledRunState: null,
  lastScheduledRunId: null,
  lastScheduledTotals: {
    totalChecks: 0,
    completedChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    warningChecks: 0,
  },
  lastScheduledError: null,
  lastScheduledChecks: [],
  ...DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT,
};

const ZERO_TOTALS = DEFAULT_ASSESSMENT_STATUS_SUMMARY.lastScheduledTotals;

/**
 * Derives published schedule fields from loaded operator configuration.
 */
export function buildAssessmentScheduleContextFromConfig(
  config: Config
): AssessmentScheduleStatusContext {
  return {
    schedulingEnabled: config.assessmentEnabled,
    scheduleIntervalSeconds: config.assessmentEnabled ? config.assessmentIntervalSeconds : null,
    scheduledAssessmentMode: config.assessmentEnabled
      ? config.assessmentMode === 'pillar'
        ? 'pillar'
        : 'full'
      : null,
    scheduledAssessmentPillar:
      config.assessmentEnabled && config.assessmentMode === 'pillar'
        ? config.assessmentPillar ?? null
        : null,
  };
}

function mapCheckSummaries(
  rows: ScheduledAssessmentLastRunSnapshot['checkSummaries']
): AssessmentCheckStatusSummary[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows.map((r) => ({
    checkId: r.checkId,
    checkName: r.checkName,
    pillar: r.pillar,
    status: r.status,
  }));
}

/**
 * Maps the in-memory scheduled assessment snapshot into a bounded status payload.
 *
 * @param snap - Last tick snapshot, or null before any tick in this process
 * @param schedule - Current operator assessment schedule configuration for status consumers
 */
export function buildAssessmentStatusSummary(
  snap: ScheduledAssessmentLastRunSnapshot | null,
  schedule: AssessmentScheduleStatusContext = DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT
): AssessmentStatusSummary {
  const sched: AssessmentScheduleStatusContext = { ...schedule };

  if (!snap) {
    return {
      ...DEFAULT_ASSESSMENT_STATUS_SUMMARY,
      lastScheduledTotals: { ...ZERO_TOTALS },
      lastScheduledChecks: [],
      ...sched,
    };
  }

  if (snap.outcome === 'failed') {
    const raw = snap.errorMessage ?? 'Scheduled assessment tick failed';
    const lastScheduledError =
      raw.length > MAX_ASSESSMENT_ERROR_SUMMARY
        ? `${raw.slice(0, MAX_ASSESSMENT_ERROR_SUMMARY - 3)}...`
        : raw;

    return {
      lastScheduledCompletedAt: snap.completedAt,
      lastScheduledOutcome: 'failed',
      lastScheduledRunState: null,
      lastScheduledRunId: null,
      lastScheduledTotals: { ...ZERO_TOTALS },
      lastScheduledError,
      lastScheduledChecks: [],
      ...sched,
    };
  }

  return {
    lastScheduledCompletedAt: snap.completedAt,
    lastScheduledOutcome: 'success',
    lastScheduledRunState: snap.state ?? null,
    lastScheduledRunId: snap.runId ?? null,
    lastScheduledTotals: {
      totalChecks: snap.totalChecks ?? 0,
      completedChecks: snap.completedChecks ?? 0,
      passedChecks: snap.passedChecks ?? 0,
      failedChecks: snap.failedChecks ?? 0,
      warningChecks: snap.warningChecks ?? 0,
    },
    lastScheduledError: null,
    lastScheduledChecks: mapCheckSummaries(snap.checkSummaries),
    ...sched,
  };
}
