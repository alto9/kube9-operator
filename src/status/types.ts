/**
 * Collection statistics for operator status
 */
export interface CollectionStats {
  /**
   * Total number of successful collections across all types
   */
  totalSuccessCount: number;
  
  /**
   * Total number of failed collections across all types
   */
  totalFailureCount: number;
  
  /**
   * Number of collections currently stored locally
   */
  collectionsStoredCount: number;
  
  /**
   * ISO 8601 timestamp of most recent successful collection
   * null if no collections have succeeded yet
   */
  lastSuccessTime: string | null;
}

/**
 * ArgoCD Status
 * Represents the current state of ArgoCD detection in the cluster
 */
export interface ArgoCDStatus {
  /**
   * Whether ArgoCD is detected in the cluster
   */
  detected: boolean;
  
  /**
   * Namespace where ArgoCD is installed
   * null if ArgoCD is not detected
   */
  namespace: string | null;
  
  /**
   * ArgoCD version extracted from deployment
   * null if not detected or version unavailable
   * @example "v2.8.0"
   */
  version: string | null;
  
  /**
   * ISO 8601 timestamp of last detection check
   * @example "2025-11-20T15:30:00Z"
   */
  lastChecked: string;
}

/**
 * Optional Trivy server detection (remote HTTP health probe)
 */
export interface TrivyStatus {
  /**
   * Whether a Trivy server was reached at the configured URL
   */
  detected: boolean;

  /**
   * Base URL of the Trivy server when detected
   */
  serverUrl: string | null;

  /**
   * Server version when available (e.g. from /version)
   */
  version: string | null;

  /**
   * ISO 8601 timestamp of last detection check
   */
  lastChecked: string;
}

/**
 * Bounded summary of the last scheduled Well-Architected assessment tick.
 * Intended for the status ConfigMap: counts and metadata only (no per-check arrays).
 */
export interface AssessmentStatusSummary {
  /**
   * ISO 8601 completion time of the last scheduled tick, or null before any tick completes.
   */
  lastScheduledCompletedAt: string | null;

  /**
   * `none` until the first scheduled tick finishes in this process; then `success` or `failed`.
   */
  lastScheduledOutcome: 'none' | 'success' | 'failed';

  /**
   * Assessment lifecycle state from the last successful run record; null if none or last tick failed.
   */
  lastScheduledRunState: string | null;

  /**
   * Storage run id for the last successful tick; null when there has been no successful completion.
   */
  lastScheduledRunId: string | null;

  /**
   * Aggregate check counts from the last successful run; all zero when no successful completion yet.
   */
  lastScheduledTotals: {
    totalChecks: number;
    completedChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
  };

  /**
   * Short error summary when `lastScheduledOutcome` is `failed`; otherwise null.
   */
  lastScheduledError: string | null;
}

/**
 * Operator Status Model
 * Represents the current state and health of the kube9 operator
 */
export interface OperatorStatus {
  /**
   * Operating mode of the operator (published for client compatibility).
   */
  mode: "operated" | "enabled";

  /**
   * Operator version (semantic versioning)
   * @example "1.0.0"
   */
  version: string;
  
  /**
   * Current health status
   * - healthy: All systems operational
   * - degraded: Non-critical issues, operating with limitations
   * - unhealthy: Critical issues, requires attention
   */
  health: "healthy" | "degraded" | "unhealthy";
  
  /**
   * ISO 8601 timestamp of last status update
   * @example "2025-11-10T15:30:00Z"
   */
  lastUpdate: string;

  /**
   * Error message if health is degraded or unhealthy
   * null when health is healthy
   */
  error: string | null;

  /**
   * Namespace where the operator is running
   * Used by external consumers to discover operator location
   * @example "kube9-system"
   */
  namespace: string;

  /**
   * Collection statistics
   * Tracks data collection activity and status
   */
  collectionStats: CollectionStats;
  
  /**
   * ArgoCD awareness information
   * Tracks whether ArgoCD is installed in the cluster
   */
  argocd: ArgoCDStatus;

  /**
   * Optional Trivy server awareness (does not install or manage Trivy)
   */
  trivy: TrivyStatus;

  /**
   * Last scheduled Well-Architected assessment tick summary (bounded; no check result list).
   */
  assessment: AssessmentStatusSummary;
}
