import type {
  OperatorStatus,
  CollectionStats,
  ArgoCDStatus,
  TrivyStatus,
  AssessmentStatusSummary,
} from './types.js';
import { DEFAULT_ASSESSMENT_STATUS_SUMMARY } from './assessment-summary.js';

/**
 * Operator version (semver)
 * TODO: Read from package.json in future
 */
const OPERATOR_VERSION = '1.0.0';

/**
 * Namespace for operator status
 * Uses POD_NAMESPACE environment variable (set by Helm via downward API)
 * Falls back to 'kube9-system' for backwards compatibility
 */
const STATUS_NAMESPACE = process.env.POD_NAMESPACE || 'kube9-system';

/**
 * Maximum length for error messages in status
 */
const MAX_ERROR_LENGTH = 500;

/**
 * Default ArgoCD status when ArgoCD detection is not yet implemented
 */
const DEFAULT_ARGOCD_STATUS: ArgoCDStatus = {
  detected: false,
  namespace: null,
  version: null,
  lastChecked: new Date().toISOString(),
};

const DEFAULT_TRIVY_STATUS: TrivyStatus = {
  detected: false,
  serverUrl: null,
  version: null,
  lastChecked: new Date().toISOString(),
};

/**
 * Calculate the current operator status from runtime signals.
 * `mode` is a fixed product constant for published JSON compatibility (not derived from secrets).
 *
 * @param lastError - Optional error message from last operation
 * @param canWriteConfigMap - Whether the operator can write to ConfigMap (defaults to true)
 * @param collectionStats - Optional collection statistics (defaults to zero stats)
 * @param argocdStatus - Optional ArgoCD detection status (defaults to not detected)
 * @param trivyStatus - Optional Trivy detection status (defaults to unavailable)
 * @param assessmentSummary - Bounded last scheduled assessment tick summary (defaults to no-run state)
 * @returns OperatorStatus object with current operator state
 */
export function calculateStatus(
  lastError: string | null = null,
  canWriteConfigMap: boolean = true,
  collectionStats: CollectionStats = {
    totalSuccessCount: 0,
    totalFailureCount: 0,
    collectionsStoredCount: 0,
    lastSuccessTime: null,
  },
  argocdStatus: ArgoCDStatus = DEFAULT_ARGOCD_STATUS,
  trivyStatus: TrivyStatus = DEFAULT_TRIVY_STATUS,
  assessmentSummary: AssessmentStatusSummary = DEFAULT_ASSESSMENT_STATUS_SUMMARY
): OperatorStatus {
  // Published status uses fixed mode; this function does not read config or credentials.
  const mode: 'operated' | 'enabled' = 'operated';

  const health = calculateHealth(canWriteConfigMap, lastError);

  let error: string | null = null;
  if (health !== 'healthy') {
    if (lastError) {
      error =
        lastError.length > MAX_ERROR_LENGTH
          ? lastError.substring(0, MAX_ERROR_LENGTH - 3) + '...'
          : lastError;
    } else if (health === 'unhealthy') {
      if (!canWriteConfigMap) {
        error = 'Failed to write status ConfigMap: check RBAC permissions';
      } else {
        error = 'Critical system error';
      }
    }
  }

  return {
    mode,
    version: OPERATOR_VERSION,
    health,
    lastUpdate: new Date().toISOString(),
    error,
    namespace: STATUS_NAMESPACE,
    collectionStats: {
      totalSuccessCount: collectionStats.totalSuccessCount,
      totalFailureCount: collectionStats.totalFailureCount,
      collectionsStoredCount: collectionStats.collectionsStoredCount,
      lastSuccessTime: collectionStats.lastSuccessTime,
    },
    argocd: argocdStatus,
    trivy: trivyStatus,
    assessment: {
      ...assessmentSummary,
      lastScheduledTotals: { ...assessmentSummary.lastScheduledTotals },
      lastScheduledChecks: assessmentSummary.lastScheduledChecks.map((c) => ({ ...c })),
    },
  };
}

/**
 * Calculate health status based on system state
 *
 * - unhealthy: Can't write ConfigMap OR critical config errors in lastError
 * - healthy: All other cases
 */
function calculateHealth(
  canWriteConfigMap: boolean,
  lastError: string | null
): 'healthy' | 'degraded' | 'unhealthy' {
  if (!canWriteConfigMap) {
    return 'unhealthy';
  }

  if (lastError && lastError.includes('config') && lastError.includes('required')) {
    return 'unhealthy';
  }

  return 'healthy';
}
