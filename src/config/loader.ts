import { kubernetesClient } from '../kubernetes/client.js';
import type { Config } from './types.js';
import { logger } from '../logging/logger.js';

const SECRET_NAME = 'kube9-operator-config';
const SECRET_NAMESPACE = 'kube9-system';
const SECRET_KEY = 'apiKey';

/**
 * Load configuration from environment variables and Kubernetes Secret
 * 
 * Reads environment variables for configuration and optionally loads API key
 * from Kubernetes Secret. If Secret doesn't exist (404), returns null for
 * apiKey - this is expected for free tier installations.
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

  // Validate required environment variables
  if (!serverUrl) {
    throw new Error('SERVER_URL environment variable is required');
  }

  // Attempt to read API key from Secret
  let apiKey: string | null = null;
  
  try {
    const secretResponse = await kubernetesClient.coreApi.readNamespacedSecret(
      SECRET_NAME,
      SECRET_NAMESPACE
    );

    const secret = secretResponse.body;
    
    // Extract and decode API key from Secret
    if (secret.data && secret.data[SECRET_KEY]) {
      const apiKeyBase64 = secret.data[SECRET_KEY];
      apiKey = Buffer.from(apiKeyBase64, 'base64').toString('utf-8');
      
      // Validate that we got a non-empty API key
      if (!apiKey || apiKey.trim().length === 0) {
        logger.warn('API key found in Secret but is empty');
        apiKey = null;
      } else {
        logger.info('API key loaded from Secret (pro tier mode)');
      }
    } else {
      logger.info('Secret exists but does not contain apiKey');
    }
  } catch (error: unknown) {
    // Handle 404 as expected (free tier - Secret doesn't exist)
    // kubernetes-client-node throws HttpError with statusCode for HTTP errors
    const httpError = error as { statusCode?: number; body?: unknown };
    
    if (httpError.statusCode === 404) {
      logger.info('Secret not found - running in free tier mode');
      apiKey = null;
    } else {
      // Other HTTP errors or network errors - log but don't crash
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (httpError.statusCode) {
        logger.error('Failed to read Secret', {
          statusCode: httpError.statusCode,
          error: errorMessage,
        });
      } else {
        logger.error('Failed to read Secret', { error: errorMessage });
      }
      logger.error('Continuing without API key (free tier mode)');
      apiKey = null;
    }
  }

  const config: Config = {
    apiKey,
    serverUrl,
    logLevel,
    statusUpdateIntervalSeconds,
    reregistrationIntervalHours,
    clusterMetadataIntervalSeconds,
    resourceInventoryIntervalSeconds,
  };

  // Log configured intervals (and any overrides)
  logger.info('Collection intervals configured', {
    clusterMetadataIntervalSeconds: config.clusterMetadataIntervalSeconds,
    resourceInventoryIntervalSeconds: config.resourceInventoryIntervalSeconds,
    clusterMetadataOverridden: process.env.CLUSTER_METADATA_INTERVAL_SECONDS !== undefined,
    resourceInventoryOverridden: process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS !== undefined,
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

