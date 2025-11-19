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

  /**
   * Cluster metadata collection interval in seconds
   * Default: 86400 (24 hours), Minimum: 3600 (1 hour)
   */
  clusterMetadataIntervalSeconds: number;

  /**
   * Resource inventory collection interval in seconds
   * Default: 21600 (6 hours), Minimum: 1800 (30 minutes)
   */
  resourceInventoryIntervalSeconds: number;

  /**
   * Resource configuration patterns collection interval in seconds
   * Default: 43200 (12 hours), Minimum: 3600 (1 hour)
   */
  resourceConfigurationPatternsIntervalSeconds: number;
}

