/**
 * Assessment metrics for Prometheus
 *
 * Provides observability for assessment runs and check execution.
 * Metrics follow kube9_operator_* naming and use bounded labels for cardinality safety.
 *
 * @see https://github.com/alto9/kube9-operator/issues/37
 */

import { Counter, Histogram, Gauge } from 'prom-client';
import { register } from '../collection/metrics.js';
import type { Pillar } from './types.js';
import { CheckStatus } from './types.js';
import type { AssessmentLifecycleState } from './contracts.js';

/** Bounded pillar values for label validation */
const PILLAR_LABELS: readonly string[] = [
  'security',
  'reliability',
  'performance-efficiency',
  'cost-optimization',
  'operational-excellence',
  'sustainability',
];

/** Bounded run state values for label validation */
const RUN_STATE_LABELS: readonly string[] = [
  'queued',
  'running',
  'completed',
  'failed',
  'partial',
];

/** Bounded check status values for label validation */
const CHECK_STATUS_LABELS: readonly string[] = [
  'passing',
  'failing',
  'warning',
  'skipped',
  'error',
  'timeout',
];

function toSafePillar(pillar: Pillar | string): string {
  return PILLAR_LABELS.includes(pillar) ? pillar : 'unknown';
}

function toSafeRunState(state: AssessmentLifecycleState | string): string {
  return RUN_STATE_LABELS.includes(state) ? state : 'unknown';
}

function toSafeCheckStatus(status: CheckStatus | string): string {
  return CHECK_STATUS_LABELS.includes(status) ? status : 'unknown';
}

/**
 * Counter for assessment runs by state
 *
 * Labels:
 * - state: Run lifecycle state (queued, running, completed, failed, partial)
 */
export const assessmentRunsTotal = new Counter({
  name: 'kube9_operator_assessment_runs_total',
  help: 'Total number of assessment runs by state',
  labelNames: ['state'],
  registers: [register],
});

/**
 * Counter for assessment checks by pillar and status
 *
 * Labels:
 * - pillar: Well-Architected pillar
 * - status: Check result (passing, failing, warning, skipped, error, timeout)
 */
export const assessmentChecksTotal = new Counter({
  name: 'kube9_operator_assessment_checks_total',
  help: 'Total number of assessment checks executed by pillar and status',
  labelNames: ['pillar', 'status'],
  registers: [register],
});

/**
 * Histogram for assessment run duration in seconds
 */
export const assessmentRunDurationSeconds = new Histogram({
  name: 'kube9_operator_assessment_run_duration_seconds',
  help: 'Duration of assessment runs in seconds',
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

/**
 * Histogram for individual check duration in seconds
 *
 * Labels:
 * - pillar: Well-Architected pillar (bounded)
 */
export const assessmentCheckDurationSeconds = new Histogram({
  name: 'kube9_operator_assessment_check_duration_seconds',
  help: 'Duration of individual assessment checks in seconds',
  labelNames: ['pillar'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Gauge for last assessment run timestamp (Unix epoch seconds)
 */
export const assessmentLastRunTimestamp = new Gauge({
  name: 'kube9_operator_assessment_last_run_timestamp',
  help: 'Unix timestamp of last completed assessment run',
  registers: [register],
});

/**
 * Gauge for last assessment score (0-100, passed/total percentage)
 */
export const assessmentLastScore = new Gauge({
  name: 'kube9_operator_assessment_last_score',
  help: 'Last assessment score as percentage of passed checks (0-100)',
  registers: [register],
});

/**
 * Records that an assessment run transitioned to a given state.
 * Call when run starts (queued->running) and when it completes (running->completed/partial/failed).
 */
export function recordRunState(state: AssessmentLifecycleState): void {
  assessmentRunsTotal.inc({ state: toSafeRunState(state) });
}

/**
 * Records a single check execution result.
 */
export function recordCheckResult(pillar: Pillar, status: CheckStatus, durationSeconds: number): void {
  const safePillar = toSafePillar(pillar);
  const safeStatus = toSafeCheckStatus(status);
  assessmentChecksTotal.inc({ pillar: safePillar, status: safeStatus });
  assessmentCheckDurationSeconds.observe({ pillar: safePillar }, durationSeconds);
}

/**
 * Records completion of an assessment run.
 * Updates last run timestamp and score.
 */
export function recordRunComplete(
  durationSeconds: number,
  totalChecks: number,
  passedChecks: number
): void {
  assessmentRunDurationSeconds.observe(durationSeconds);
  assessmentLastRunTimestamp.set(Math.floor(Date.now() / 1000));
  const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
  assessmentLastScore.set(score);
}
