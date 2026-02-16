import type { Config } from './types.js';
import { logger } from '../logging/logger.js';

/**
 * Load configuration from environment variables
 *
 * @returns Promise resolving to Config object
 * @throws Error if required environment variables are missing
 */
export async function loadConfig(): Promise<Config> {
  // Read environment variables with defaults
  const logLevel = process.env.LOG_LEVEL || 'info';
  const serverUrl = process.env.SERVER_URL;
  const statusUpdateIntervalSeconds = parseInt(
    process.env.STATUS_UPDATE_INTERVAL_SECONDS || '60',
    10
  );
  const reregistrationIntervalHours = parseInt(
    process.env.REREGISTRATION_INTERVAL_HOURS || '24',
    10
  );
  const clusterMetadataIntervalSeconds = parseInt(
    process.env.CLUSTER_METADATA_INTERVAL_SECONDS || '86400',
    10
  );
  const resourceInventoryIntervalSeconds = parseInt(
    process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS || '21600',
    10
  );
  const resourceConfigurationPatternsIntervalSeconds = parseInt(
    process.env.RESOURCE_CONFIGURATION_PATTERNS_INTERVAL_SECONDS || '43200',
    10
  );
  const eventRetentionInfoWarningDays = parseInt(
    process.env.EVENT_RETENTION_INFO_WARNING_DAYS || '7',
    10
  );
  const eventRetentionErrorCriticalDays = parseInt(
    process.env.EVENT_RETENTION_ERROR_CRITICAL_DAYS || '30',
    10
  );

  // Validate required environment variables
  if (!serverUrl) {
    throw new Error('SERVER_URL environment variable is required');
  }

  const config: Config = {
    serverUrl,
    logLevel,
    statusUpdateIntervalSeconds,
    reregistrationIntervalHours,
    clusterMetadataIntervalSeconds,
    resourceInventoryIntervalSeconds,
    resourceConfigurationPatternsIntervalSeconds,
    eventRetentionInfoWarningDays,
    eventRetentionErrorCriticalDays,
  };

  // Log configured intervals (and any overrides)
  logger.info('Collection intervals configured', {
    clusterMetadataIntervalSeconds: config.clusterMetadataIntervalSeconds,
    resourceInventoryIntervalSeconds: config.resourceInventoryIntervalSeconds,
    resourceConfigurationPatternsIntervalSeconds: config.resourceConfigurationPatternsIntervalSeconds,
    clusterMetadataOverridden: process.env.CLUSTER_METADATA_INTERVAL_SECONDS !== undefined,
    resourceInventoryOverridden: process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS !== undefined,
    resourceConfigurationPatternsOverridden: process.env.RESOURCE_CONFIGURATION_PATTERNS_INTERVAL_SECONDS !== undefined,
  });

  return config;
}

/**
 * Singleton config instance
 * Loaded once at startup
 */
let configInstance: Config | null = null;

/**
 * Get the loaded configuration singleton
 * 
 * @returns Config instance
 * @throws Error if config has not been loaded yet
 */
export function getConfig(): Config {
  if (configInstance === null) {
    throw new Error('Config has not been loaded yet. Call loadConfig() first.');
  }
  return configInstance;
}

/**
 * Set the config instance (used after loading)
 * 
 * @param config - The loaded configuration
 */
export function setConfig(config: Config): void {
  configInstance = config;
}

