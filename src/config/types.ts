/**
 * Configuration interface for kube9-operator
 */
export interface Config {
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

  /**
   * Event retention for info/warning severity (days)
   * Default: 7 days
   */
  eventRetentionInfoWarningDays: number;

  /**
   * Event retention for error/critical severity (days)
   * Default: 30 days
   */
  eventRetentionErrorCriticalDays: number;
}

