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
 * Aggregate counts from persisted Argo CD Application rows (`argocd_apps`), for status ConfigMap only.
 */
export interface ArgoCDApplicationsPersistedSummary {
  storedCount: number;
  lastCollectedAt: string | null;
  syncStatusCounts: Record<string, number>;
  healthStatusCounts: Record<string, number>;
}

/**
 * Last global demotion reason for resource-tree capability (bounded; no tokens).
 */
export interface ArgoCDResourceTreeLastError {
  code: string;
  message: string;
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

  /**
   * Optional summary derived from SQLite `argocd_apps` when snapshots exist (omitted when none).
   */
  applications?: ArgoCDApplicationsPersistedSummary;

  /**
   * Whether on-demand resource-tree enrichment is available after probe success.
   * Omitted when Argo CD is not detected.
   */
  resourceTreeCapable?: boolean;

  /**
   * Last cluster-wide demotion reason when {@link resourceTreeCapable} is false.
   * Omitted when capable is true or Argo CD is not detected.
   */
  resourceTreeLastError?: ArgoCDResourceTreeLastError;
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
 * One row per check from the last successful scheduled assessment run.
 * Detail fields are bounded before publishing (see assessment-repository.getCheckSummariesForRun).
 */
export interface AssessmentCheckStatusSummary {
  checkId: string;
  checkName: string;
  pillar: string;
  status: string;
  /** Short explanation when the check did not pass (omitted for passing checks when empty). */
  message?: string | null;
  /** Suggested remediation / next steps when present. */
  remediation?: string | null;
}

/**
 * Bounded summary of the last scheduled Well-Architected assessment tick.
 * Intended for the status ConfigMap: counts, scheduling hints, and per-check outcomes.
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

  /**
   * Per-check results from the last successful scheduled run; empty when none or last tick failed.
   */
  lastScheduledChecks: AssessmentCheckStatusSummary[];

  /**
   * Whether periodic in-cluster assessments are enabled via operator configuration.
   */
  schedulingEnabled: boolean;

  /**
   * Seconds between scheduled runs when {@link schedulingEnabled} is true; otherwise null.
   */
  scheduleIntervalSeconds: number | null;

  /**
   * Configured scheduled assessment scope: full framework vs single pillar.
   */
  scheduledAssessmentMode: 'full' | 'pillar' | null;

  /**
   * When `scheduledAssessmentMode` is `pillar`, the pillar id; otherwise null.
   */
  scheduledAssessmentPillar: string | null;
}

/**
 * Aggregate counts for the latest Kubernetes AI Conformance readiness run.
 */
export interface AiConformanceTotals {
  totalRequirements: number;
  mustRequirements: number;
  shouldRequirements: number;
  passed: number;
  failed: number;
  warning: number;
  notApplicable: number;
  notEvaluated: number;
  needsEvidence: number;
}

/**
 * Rollup counts for one checklist category in the published status payload.
 */
export interface AiConformanceCategorySummary {
  total: number;
  passed: number;
  failed: number;
  warning: number;
  notApplicable: number;
  notEvaluated: number;
  needsEvidence: number;
}

/**
 * Bounded per-requirement row for status ConfigMap JSON.
 */
export interface AiConformanceRequirementSummary {
  id: string;
  category: string;
  level: 'MUST' | 'SHOULD';
  title: string;
  status:
    | 'passed'
    | 'failed'
    | 'warning'
    | 'not-applicable'
    | 'not-evaluated'
    | 'needs-evidence';
  rationale: string;
  evidenceRef?: string | null;
}

/**
 * Bounded Kubernetes AI Conformance readiness summary for kube9-vscode and kube9-desktop.
 * Kube9 readiness assessment, not official CNCF certification.
 */
export interface AiConformanceSummary {
  checklistVersion: string;
  kubernetesMinor: string;
  sourceRevision: string | null;
  lastCompletedAt: string | null;
  lastOutcome: 'none' | 'success' | 'failed';
  runState: 'completed' | 'failed' | 'partial' | null;
  runId: string | null;
  totals: AiConformanceTotals;
  categories: Record<string, AiConformanceCategorySummary>;
  requirements: AiConformanceRequirementSummary[];
  error: string | null;
  schedulingEnabled: boolean;
  scheduleIntervalSeconds: number | null;
  checklistSource: string | null;
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
   * Last scheduled Well-Architected assessment tick summary (counts, schedule, per-check statuses).
   */
  assessment: AssessmentStatusSummary;

  /**
   * Latest Kubernetes AI Conformance readiness summary (bounded; not CNCF certification).
   */
  aiConformance: AiConformanceSummary;
}
