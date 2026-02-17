/**
 * Assessment Check Interfaces and Core Types
 *
 * Typed contracts for Well-Architected Framework checks, results,
 * pillar taxonomy, and run context. Single canonical type layer for
 * all downstream modules.
 */

import type { KubernetesClient } from '../kubernetes/client.js';
import type { Config } from '../config/types.js';
import type { Logger } from 'winston';

// ---------------------------------------------------------------------------
// Pillar Taxonomy
// ---------------------------------------------------------------------------

/**
 * Well-Architected Framework pillars (Kubernetes lens)
 * Aligns with AWS Well-Architected Framework 6 pillars
 */
export enum Pillar {
  Security = 'security',
  Reliability = 'reliability',
  PerformanceEfficiency = 'performance-efficiency',
  CostOptimization = 'cost-optimization',
  OperationalExcellence = 'operational-excellence',
  Sustainability = 'sustainability',
}

/**
 * All valid pillar string values (for validation and DB serialization)
 */
export const PILLAR_VALUES: readonly string[] = Object.values(Pillar);

/**
 * Type guard: is the value a valid Pillar?
 */
export function isPillar(value: unknown): value is Pillar {
  return typeof value === 'string' && PILLAR_VALUES.includes(value);
}

// ---------------------------------------------------------------------------
// Check Result Status
// ---------------------------------------------------------------------------

/**
 * Check result status - matches assessment_history.status CHECK constraint
 * No ambiguous strings; use these exclusively in implementation code.
 */
export enum CheckStatus {
  Passing = 'passing',
  Failing = 'failing',
  Warning = 'warning',
  Skipped = 'skipped',
  Error = 'error',
  Timeout = 'timeout',
}

/**
 * All valid check status string values
 */
export const CHECK_STATUS_VALUES: readonly string[] = Object.values(CheckStatus);

/**
 * Type guard: is the value a valid CheckStatus?
 */
export function isCheckStatus(value: unknown): value is CheckStatus {
  return typeof value === 'string' && CHECK_STATUS_VALUES.includes(value);
}

// ---------------------------------------------------------------------------
// Severity (for ordering/prioritization)
// ---------------------------------------------------------------------------

/**
 * Severity levels for check results (used for ordering and display)
 */
export enum Severity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info',
}

/**
 * All valid severity string values
 */
export const SEVERITY_VALUES: readonly string[] = Object.values(Severity);

/**
 * Type guard: is the value a valid Severity?
 */
export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && SEVERITY_VALUES.includes(value);
}

// ---------------------------------------------------------------------------
// Assessment Run Mode and State
// ---------------------------------------------------------------------------

/**
 * Assessment run mode - matches assessments.mode CHECK constraint
 */
export enum AssessmentRunMode {
  Full = 'full',
  Pillar = 'pillar',
  SingleCheck = 'single-check',
}

/**
 * Assessment run state - matches assessments.state CHECK constraint
 */
export enum AssessmentRunState {
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Partial = 'partial',
}

/**
 * Type guards for run mode and state
 */
export function isAssessmentRunMode(value: unknown): value is AssessmentRunMode {
  return (
    typeof value === 'string' &&
    ['full', 'pillar', 'single-check'].includes(value)
  );
}

export function isAssessmentRunState(value: unknown): value is AssessmentRunState {
  return (
    typeof value === 'string' &&
    ['queued', 'running', 'completed', 'failed', 'partial'].includes(value)
  );
}

// ---------------------------------------------------------------------------
// Run Context
// ---------------------------------------------------------------------------

/**
 * Context passed to each check during execution.
 * Provides Kubernetes client, config, timeout, logger, and run metadata.
 */
export interface AssessmentRunContext {
  /** Kubernetes API client for cluster operations */
  kubernetes: KubernetesClient;
  /** Operator configuration */
  config: Config;
  /** Per-check timeout in milliseconds */
  timeoutMs: number;
  /** Logger for check output */
  logger: Logger;
  /** Current run identifier */
  runId: string;
  /** Run mode (full, pillar, single-check) */
  mode: AssessmentRunMode;
  /** Optional pillar filter when mode is 'pillar' */
  pillarFilter?: Pillar;
  /** Optional single check ID when mode is 'single-check' */
  checkIdFilter?: string;
}

// ---------------------------------------------------------------------------
// Check Result
// ---------------------------------------------------------------------------

/**
 * Result of a single assessment check execution
 */
export interface AssessmentCheckResult {
  /** Unique check identifier (e.g., 'security.pod-security-context') */
  checkId: string;
  /** Human-readable check name */
  checkName?: string;
  /** Pillar this check belongs to */
  pillar: Pillar;
  /** Result status */
  status: CheckStatus;
  /** Optional severity for prioritization */
  severity?: Severity;
  /** Optional Kubernetes object kind (e.g., 'Pod', 'Deployment') */
  objectKind?: string;
  /** Optional object namespace */
  objectNamespace?: string;
  /** Optional object name */
  objectName?: string;
  /** Human-readable message describing the result */
  message?: string;
  /** Remediation guidance */
  remediation?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error code if status is 'error' or 'timeout' */
  errorCode?: string;
}

// ---------------------------------------------------------------------------
// AssessmentCheck Interface
// ---------------------------------------------------------------------------

/**
 * Contract for assessment checks. Check authors implement this interface.
 */
export interface AssessmentCheck {
  /** Unique identifier (e.g., 'security.pod-security-context') */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Pillar this check belongs to */
  readonly pillar: Pillar;
  /** Optional description */
  readonly description?: string;
  /** Optional severity default */
  readonly defaultSeverity?: Severity;

  /**
   * Execute the check against the cluster.
   * @param ctx - Run context with Kubernetes client, config, logger, etc.
   * @returns Promise resolving to the check result
   */
  run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult>;
}

// ---------------------------------------------------------------------------
// Run Summary Types (storage and CLI)
// ---------------------------------------------------------------------------

/**
 * Summary of a completed assessment run.
 * Used by storage layer and CLI output.
 */
export interface AssessmentRunSummary {
  runId: string;
  mode: AssessmentRunMode;
  state: AssessmentRunState;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  totalChecks: number;
  completedChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  skippedChecks: number;
  errorChecks: number;
  timeoutChecks: number;
  failureReason?: string;
}

/**
 * Single check result as stored/returned (e.g., from assessment_history)
 */
export interface AssessmentHistoryEntry {
  id: string;
  runId: string;
  checkId: string;
  pillar: Pillar;
  checkName?: string;
  status: CheckStatus;
  objectKind?: string;
  objectNamespace?: string;
  objectName?: string;
  message?: string;
  remediation?: string;
  assessedAt: string;
  durationMs?: number;
  errorCode?: string;
}
