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
   * Error message if health is degraded or unhealthy
   * null when health is healthy
   */
  error: string | null;
  
  /**
   * Server-assigned cluster ID
   * Only present when tier="pro" and registered=true
   * @example "cls_abc123def456"
   */
  clusterId?: string;
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

