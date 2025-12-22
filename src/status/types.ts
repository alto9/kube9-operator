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
 * Operator Status Model
 * Represents the current state and health of the kube9 operator
 */
export interface OperatorStatus {
  /**
   * Operating mode of the operator
   * - operated: Free tier (no API key or invalid key)
   * - enabled: Pro tier (valid API key and registered)
   */
  mode: "operated" | "enabled";
  
  /**
   * User-facing tier name
   * - free: Limited features
   * - pro: Full features with AI
   */
  tier: "free" | "pro";
  
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
   * Whether operator is registered with kube9-server
   * true only when mode="enabled" and registration successful
   */
  registered: boolean;
  
  /**
   * Whether an API key is configured
   * true when API key is present (regardless of registration status)
   */
  apiKeyConfigured: boolean;
  
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
   * Server-assigned cluster ID
   * Only present when tier="pro" and registered=true
   * @example "cls_abc123def456"
   */
  clusterId?: string;
  
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
}

/**
 * Registration State
 * Represents the current registration status with kube9-server
 * Used by the status calculator to determine tier and health
 */
export interface RegistrationState {
  /**
   * Whether the operator is currently registered with kube9-server
   */
  isRegistered: boolean;
  
  /**
   * Server-assigned cluster ID (only present when registered)
   * @example "cls_abc123def456"
   */
  clusterId?: string;
  
  /**
   * Number of consecutive registration failures
   * Used for health calculation (degraded if > 3)
   */
  consecutiveFailures?: number;
}


