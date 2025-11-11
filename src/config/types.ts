/**
 * Configuration interface for kube9-operator
 */
export interface Config {
  /**
   * API key for pro tier (null if not configured - free tier)
   */
  apiKey: string | null;

  /**
   * kube9-server base URL
   */
  serverUrl: string;

  /**
   * Logging level (info, debug, warn, error)
   */
  logLevel: string;

  /**
   * How often to update status ConfigMap (seconds)
   */
  statusUpdateIntervalSeconds: number;

  /**
   * How often to re-register with server (hours)
   */
  reregistrationIntervalHours: number;
}

