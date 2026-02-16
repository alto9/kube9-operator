import type { OperatorStatus, RegistrationState, CollectionStats, ArgoCDStatus } from './types.js';

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
 * Default registration state when registration manager is not available
 */
const DEFAULT_REGISTRATION_STATE: RegistrationState = {
  isRegistered: false,
  clusterId: undefined,
  consecutiveFailures: 0,
};

/**
 * Default ArgoCD status when ArgoCD detection is not yet implemented
 */
const DEFAULT_ARGOCD_STATUS: ArgoCDStatus = {
  detected: false,
  namespace: null,
  version: null,
  lastChecked: new Date().toISOString(),
};

/**
 * Calculate the current operator status based on configuration and system state
 * 
 * @param registrationState - Optional registration state (defaults to unregistered)
 * @param lastError - Optional error message from last operation
 * @param canWriteConfigMap - Whether the operator can write to ConfigMap (defaults to true)
 * @param collectionStats - Optional collection statistics (defaults to zero stats)
 * @param argocdStatus - Optional ArgoCD detection status (defaults to not detected)
 * @returns OperatorStatus object with current operator state
 */
export function calculateStatus(
  registrationState: RegistrationState = DEFAULT_REGISTRATION_STATE,
  lastError: string | null = null,
  canWriteConfigMap: boolean = true,
  collectionStats: CollectionStats = {
    totalSuccessCount: 0,
    totalFailureCount: 0,
    collectionsStoredCount: 0,
    lastSuccessTime: null
  },
  argocdStatus: ArgoCDStatus = DEFAULT_ARGOCD_STATUS
): OperatorStatus {
  const { isRegistered, clusterId, consecutiveFailures = 0 } = registrationState;
  
  // API key and registration dependencies have been removed.
  const mode: "operated" | "enabled" = "operated";
  const tier: "free" | "pro" = "free";
  
  // Calculate health based on system state
  const health = calculateHealth(
    consecutiveFailures,
    canWriteConfigMap,
    lastError
  );
  
  // Determine error message
  // If health is healthy, error must be null
  // Otherwise, use provided error or generate one based on health state
  let error: string | null = null;
  if (health !== "healthy") {
    if (lastError) {
      // Truncate error message if too long
      error = lastError.length > MAX_ERROR_LENGTH
        ? lastError.substring(0, MAX_ERROR_LENGTH - 3) + "..."
        : lastError;
    } else {
      // Generate error message based on health state
      if (health === "unhealthy") {
        if (!canWriteConfigMap) {
          error = "Failed to write status ConfigMap: check RBAC permissions";
        } else {
          error = "Critical system error";
        }
      } else if (health === "degraded" && consecutiveFailures > 3) {
        error = `Registration failed ${consecutiveFailures} times consecutively`;
      }
    }
  }
  
  // Build status object
  const status: OperatorStatus = {
    mode,
    tier,
    version: OPERATOR_VERSION,
    health,
    lastUpdate: new Date().toISOString(),
    registered: isRegistered,
    error,
    namespace: STATUS_NAMESPACE,
    collectionStats: {
      totalSuccessCount: collectionStats.totalSuccessCount,
      totalFailureCount: collectionStats.totalFailureCount,
      collectionsStoredCount: collectionStats.collectionsStoredCount,
      lastSuccessTime: collectionStats.lastSuccessTime
    },
    argocd: argocdStatus
  };
  
  // Include clusterId only when registered (pro tier)
  if (isRegistered && clusterId) {
    status.clusterId = clusterId;
  }
  
  return status;
}

/**
 * Calculate health status based on system state
 * 
 * Health determination logic:
 * - unhealthy: Can't write ConfigMap OR config errors
 * - degraded: Consecutive registration failures > 3
 * - healthy: All other cases
 * 
 * @param consecutiveFailures - Number of consecutive registration failures
 * @param canWriteConfigMap - Whether operator can write to ConfigMap
 * @param lastError - Last error message (if any)
 * @returns Health status
 */
function calculateHealth(
  consecutiveFailures: number,
  canWriteConfigMap: boolean,
  lastError: string | null
): "healthy" | "degraded" | "unhealthy" {
  // Critical: Can't write to Kubernetes API
  if (!canWriteConfigMap) {
    return "unhealthy";
  }
  
  // Critical: Config errors (if we detect any)
  // Note: Config loader throws on invalid config, so if we get here, config is valid
  // But we check lastError for any critical errors
  if (lastError && lastError.includes("config") && lastError.includes("required")) {
    return "unhealthy";
  }
  
  // Degraded: Registration attempts failing repeatedly
  if (consecutiveFailures > 3) {
    return "degraded";
  }
  
  return "healthy";
}


