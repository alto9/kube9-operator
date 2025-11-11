/**
 * Registration Data Types
 * 
 * Types for registration request and response matching the kube9-server API specification
 */

/**
 * Registration request sent to kube9-server
 */
export interface RegistrationRequest {
  /**
   * Operator version following semantic versioning
   * @example "1.0.0"
   */
  operatorVersion: string;

  /**
   * Unique cluster identifier (SHA256 hash of cluster CA cert or server URL)
   * @example "sha256:a1b2c3d4e5f6..."
   */
  clusterIdentifier: string;

  /**
   * Kubernetes version running in the cluster
   * @example "1.28.0"
   */
  kubernetesVersion: string;

  /**
   * Approximate number of nodes in the cluster
   * Used for capacity planning, does not need to be exact
   * @example 5
   */
  approximateNodeCount: number;
}

/**
 * Configuration settings returned by server
 */
export interface RegistrationConfiguration {
  /**
   * How often to update the status ConfigMap (in seconds)
   * @default 60
   */
  statusUpdateIntervalSeconds: number;

  /**
   * How often to re-register with the server (in hours)
   * @default 24
   */
  reregistrationIntervalHours: number;

  /**
   * Whether to collect cluster metrics (future feature)
   * @default false
   */
  metricsEnabled?: boolean;

  /**
   * How often to collect metrics (in seconds, future feature)
   * @default 300
   */
  metricsIntervalSeconds?: number;
}

/**
 * Registration response from kube9-server
 */
export interface RegistrationResponse {
  /**
   * Registration status
   * - registered: First-time registration
   * - reregistered: Subsequent registration
   */
  status: "registered" | "reregistered";

  /**
   * Server-assigned cluster ID
   * Unique identifier for this cluster in kube9 system
   * @example "cls_abc123def456"
   */
  clusterId: string;

  /**
   * Confirmed tier
   * Only "pro" is returned for successful registration
   */
  tier: "pro";

  /**
   * Configuration settings for the operator
   */
  configuration: RegistrationConfiguration;

  /**
   * Optional message from server to operator
   * Can be displayed in logs or status
   * @example "Welcome to kube9 Pro!"
   */
  message?: string;
}

/**
 * Error response from server
 */
export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Base error class for registration errors
 */
export class RegistrationError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when API key is invalid, expired, or revoked (401)
 */
export class UnauthorizedError extends RegistrationError {
  constructor(message: string = "API key is invalid or has been revoked") {
    super(message, 401);
  }
}

/**
 * Error thrown when rate limit is exceeded (429)
 */
export class RateLimitError extends RegistrationError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 429);
  }
}

/**
 * Error thrown for bad request (400)
 */
export class BadRequestError extends RegistrationError {
  constructor(message: string = "Invalid request format or missing required fields") {
    super(message, 400);
  }
}

/**
 * Error thrown for server errors (5xx)
 */
export class ServerError extends RegistrationError {
  constructor(message: string = "Server error occurred", statusCode: number = 500) {
    super(message, statusCode);
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends RegistrationError {
  constructor(message: string = "Registration request timed out after 30 seconds") {
    super(message);
  }
}

