/**
 * kube9-operator entry point
 */

import { kubernetesClient } from './kubernetes/client.js';
import { loadConfig, setConfig, getConfig } from './config/loader.js';
import type { Config } from './config/types.js';
import { StatusWriter } from './status/writer.js';
import { RegistrationManager } from './registration/manager.js';
import { RegistrationClient } from './registration/client.js';
import { generateClusterIdentifier } from './cluster/identifier.js';
import { startHealthServer } from './health/server.js';
import { setInitialized } from './health/state.js';
import { gracefulShutdown } from './shutdown/handler.js';
import { CollectionScheduler } from './collection/scheduler.js';
import { ClusterMetadataCollector } from './collection/collectors/cluster-metadata.js';
import { ResourceInventoryCollector } from './collection/collectors/resource-inventory.js';
import { LocalStorage } from './collection/storage.js';
import { TransmissionClient } from './collection/transmission.js';
import { recordCollection } from './collection/metrics.js';
import { logger } from './logging/logger.js';

logger.info('kube9-operator starting...');

// Module-level references for shutdown handler
let statusWriterInstance: StatusWriter | null = null;
let registrationManagerInstance: RegistrationManager | null = null;
let collectionSchedulerInstance: CollectionScheduler | null = null;

// Load configuration
async function initializeConfig(): Promise<Config> {
  try {
    logger.info('Loading configuration...');
    const config = await loadConfig();
    setConfig(config);
    
    // Log config loaded (without sensitive data)
    logger.info('Configuration loaded', {
      serverUrl: config.serverUrl,
      logLevel: config.logLevel,
      statusUpdateIntervalSeconds: config.statusUpdateIntervalSeconds,
      reregistrationIntervalHours: config.reregistrationIntervalHours,
      tier: config.apiKey ? 'pro' : 'free',
    });
    
    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load configuration', { error: errorMessage });
    throw error;
  }
}

// Test Kubernetes client initialization
async function testKubernetesClient() {
  try {
    logger.info('Testing Kubernetes client...');
    
    const clusterInfo = await kubernetesClient.getClusterInfo();
    logger.info('Cluster info retrieved successfully', {
      kubernetesVersion: clusterInfo.version,
      nodeCount: clusterInfo.nodeCount,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to connect to Kubernetes cluster', {
      error: errorMessage,
      note: 'This is expected if running outside a cluster. The operator will retry when deployed.',
    });
  }
}

// Initialize and run
async function main() {
  try {
    // Load config first
    const config = await initializeConfig();
    
    // Start health server early so probes are available during initialization
    startHealthServer(8080);
    
    // Test Kubernetes client
    await testKubernetesClient();
    
    // Initialize registration manager if API key is present
    let registrationManager: RegistrationManager | null = null;
    if (config.apiKey) {
      logger.info('Initializing registration manager...');
      const registrationClient = new RegistrationClient(
        config.serverUrl,
        config.apiKey
      );
      registrationManager = new RegistrationManager(
        config,
        registrationClient,
        generateClusterIdentifier,
        () => kubernetesClient.getClusterInfo()
      );
      
      // Start registration (non-blocking)
      registrationManager.start().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to start registration', { error: errorMessage });
        // Continue running even if registration fails initially
      });
    }
    
    // Store reference for shutdown handler
    registrationManagerInstance = registrationManager;
    
    // Start status writer for periodic ConfigMap updates
    logger.info('Starting status writer...');
    const statusWriter = new StatusWriter(
      kubernetesClient,
      config.statusUpdateIntervalSeconds,
      registrationManager ?? undefined
    );
    statusWriter.start();
    
    // Store reference for shutdown handler
    statusWriterInstance = statusWriter;
    
    // Initialize collection scheduler
    logger.info('Initializing collection scheduler...');
    const collectionScheduler = new CollectionScheduler();
    
    // Initialize collection infrastructure
    const localStorage = new LocalStorage();
    const transmissionClient = config.apiKey
      ? new TransmissionClient(config.serverUrl, config.apiKey)
      : null;
    
    // Initialize cluster metadata collector
    const clusterMetadataCollector = new ClusterMetadataCollector(
      kubernetesClient,
      localStorage,
      transmissionClient,
      config
    );
    
    // Register cluster metadata collection task
    collectionScheduler.register(
      'cluster-metadata',
      86400, // 24 hours default interval
      3600,  // 1 hour minimum interval
      3600,  // 0-1 hour random offset range
      async () => {
        const startTime = Date.now();
        try {
          const metadata = await clusterMetadataCollector.collect();
          await clusterMetadataCollector.processCollection(metadata);
          
          // Record successful collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('cluster-metadata', 'success', durationSeconds);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Cluster metadata collection failed', { error: errorMessage });
          
          // Record failed collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('cluster-metadata', 'failed', durationSeconds);
          // Don't throw - scheduler will retry on next interval
        }
      }
    );
    
    // Initialize resource inventory collector
    const resourceInventoryCollector = new ResourceInventoryCollector(
      kubernetesClient,
      localStorage,
      transmissionClient,
      config
    );
    
    // Register resource inventory collection task
    collectionScheduler.register(
      'resource-inventory',
      21600, // 6 hours default interval
      1800,  // 30 minutes minimum interval
      1800,  // 0-30 minutes random offset range
      async () => {
        const startTime = Date.now();
        try {
          const inventory = await resourceInventoryCollector.collect();
          await resourceInventoryCollector.processCollection(inventory);
          
          // Record successful collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('resource-inventory', 'success', durationSeconds);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Resource inventory collection failed', { error: errorMessage });
          
          // Record failed collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('resource-inventory', 'failed', durationSeconds);
          // Don't throw - scheduler will retry on next interval
        }
      }
    );
    
    // Start scheduler
    collectionScheduler.start();
    
    // Store reference for shutdown handler
    collectionSchedulerInstance = collectionScheduler;
    
    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', () => {
      if (statusWriterInstance) {
        gracefulShutdown(statusWriterInstance, registrationManagerInstance, collectionSchedulerInstance).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error in shutdown handler', { error: errorMessage });
          process.exit(1);
        });
      }
    });
    
    process.on('SIGINT', () => {
      if (statusWriterInstance) {
        gracefulShutdown(statusWriterInstance, registrationManagerInstance, collectionSchedulerInstance).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error in shutdown handler', { error: errorMessage });
          process.exit(1);
        });
      }
    });
    
    // Mark operator as initialized - readiness probe will now pass
    setInitialized(true);
    
    logger.info('kube9-operator initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize operator', { error: errorMessage });
    process.exit(1);
  }
}

// Run initialization
main().catch((error) => {
  logger.error('Unexpected error during initialization', { error });
  process.exit(1);
});

// Export config singleton
export { getConfig };
export type { Config };

