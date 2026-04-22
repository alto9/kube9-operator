import type { ScheduledAssessmentLastRunSnapshot } from '../assessment/scheduled-tick.js';
import type { AssessmentStatusSummary } from './types.js';

const MAX_ASSESSMENT_ERROR_SUMMARY = 200;

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
};

const ZERO_TOTALS = DEFAULT_ASSESSMENT_STATUS_SUMMARY.lastScheduledTotals;

/**
 * Maps the in-memory scheduled assessment snapshot into a bounded status payload.
 */
export function buildAssessmentStatusSummary(
  snap: ScheduledAssessmentLastRunSnapshot | null
): AssessmentStatusSummary {
  if (!snap) {
    return {
      ...DEFAULT_ASSESSMENT_STATUS_SUMMARY,
      lastScheduledTotals: { ...ZERO_TOTALS },
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
  };
}
