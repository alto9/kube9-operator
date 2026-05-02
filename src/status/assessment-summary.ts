import type { ScheduledAssessmentLastRunSnapshot } from '../assessment/scheduled-tick.js';
import type { AssessmentRunRecord } from '../assessment/contracts.js';
import type { Config } from '../config/types.js';
import { AssessmentRepository } from '../database/assessment-repository.js';
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

function parseCompletedMs(iso: string | null | undefined): number {
  if (!iso) {
    return Number.NEGATIVE_INFINITY;
  }
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

function mapCheckSummaries(
  rows: ScheduledAssessmentLastRunSnapshot['checkSummaries']
): AssessmentCheckStatusSummary[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows.map((r) => {
    const base: AssessmentCheckStatusSummary = {
      checkId: r.checkId,
      checkName: r.checkName,
      pillar: r.pillar,
      status: r.status,
    };
    const message = r.message;
    const remediation = r.remediation;
    return {
      ...base,
      ...(message != null && message !== '' ? { message } : {}),
      ...(remediation != null && remediation !== '' ? { remediation } : {}),
    };
  });
}

/**
 * Latest completed assessment stored in SQLite (shared volume in the operator pod).
 * Used so `kube9-operator assess run` via `kubectl exec` updates the same DB the main
 * process reads when publishing status — exec runs a separate Node process, so in-memory
 * snapshots from the CLI are not visible to the operator.
 */
export function loadLatestPersistedAssessment(repo: AssessmentRepository): {
  record: AssessmentRunRecord | null;
  checks: AssessmentCheckStatusSummary[];
} {
  const rows = repo.queryAssessments({ limit: 1 });
  const record = rows[0] ?? null;
  if (!record?.completed_at) {
    return { record: null, checks: [] };
  }
  return { record, checks: repo.getCheckSummariesForRun(record.run_id) };
}

/**
 * Maps scheduled-tick snapshot and/or latest persisted assessment into the status payload.
 *
 * Prefers the newest completed assessment by timestamp: SQLite when it is at least as new as
 * the in-process snapshot, otherwise the in-memory snapshot (e.g. before any DB flush).
 * A failed tick snapshot wins when it is newer than the latest DB completion.
 *
 * @param snap - Last tick snapshot in the main operator process
 * @param schedule - Assessment schedule from config
 * @param latestDbRun - Latest assessment row from SQLite (optional)
 * @param dbCheckSummaries - Check summaries for latestDbRun (optional)
 */
export function buildAssessmentStatusSummary(
  snap: ScheduledAssessmentLastRunSnapshot | null,
  schedule: AssessmentScheduleStatusContext = DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT,
  latestDbRun: AssessmentRunRecord | null = null,
  dbCheckSummaries: AssessmentCheckStatusSummary[] | null = null
): AssessmentStatusSummary {
  const sched: AssessmentScheduleStatusContext = { ...schedule };
  const snapMs = snap ? parseCompletedMs(snap.completedAt) : Number.NEGATIVE_INFINITY;
  const dbMs = latestDbRun?.completed_at ? parseCompletedMs(latestDbRun.completed_at) : Number.NEGATIVE_INFINITY;

  if (snap?.outcome === 'failed' && snapMs >= dbMs) {
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

  if (latestDbRun?.completed_at && dbMs >= snapMs) {
    const checks = dbCheckSummaries ?? [];
    return {
      lastScheduledCompletedAt: latestDbRun.completed_at,
      lastScheduledOutcome: 'success',
      lastScheduledRunState: latestDbRun.state ?? null,
      lastScheduledRunId: latestDbRun.run_id,
      lastScheduledTotals: {
        totalChecks: latestDbRun.total_checks,
        completedChecks: latestDbRun.completed_checks,
        passedChecks: latestDbRun.passed_checks,
        failedChecks: latestDbRun.failed_checks,
        warningChecks: latestDbRun.warning_checks,
      },
      lastScheduledError: null,
      lastScheduledChecks: checks.map((c) => ({ ...c })),
      ...sched,
    };
  }

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
