/**
 * kube9-operator main control loop
 */

import { kubernetesClient } from './kubernetes/client.js';
import { loadConfig, setConfig } from './config/loader.js';
import type { Config } from './config/types.js';
import { StatusWriter } from './status/writer.js';
import { startHealthServer } from './health/server.js';
import { setInitialized } from './health/state.js';
import { gracefulShutdown } from './shutdown/handler.js';
import { CollectionScheduler } from './collection/scheduler.js';
import { ClusterMetadataCollector } from './collection/collectors/cluster-metadata.js';
import { ResourceInventoryCollector } from './collection/collectors/resource-inventory.js';
import { ResourceConfigurationPatternsCollector } from './collection/collectors/resource-configuration-patterns.js';
import { LocalStorage } from './collection/storage.js';
import { recordCollection } from './collection/metrics.js';
import { collectionStatsTracker } from './collection/stats-tracker.js';
import { logger } from './logging/logger.js';
import { detectArgoCDWithTimeout, parseArgoCDConfigFromEnv } from './argocd/detection.js';
import { collectApplicationSnapshots } from './argocd/application-snapshot-collect.js';
import { runApplicationDriftCycle } from './argocd/application-drift-cycle.js';
import { argocdStatusTracker } from './argocd/state.js';
import { ArgoCDDetectionManager } from './argocd/detection-manager.js';
import { detectTrivyWithTimeout } from './trivy/detection.js';
import { parseTrivyDetectionConfigFromEnv } from './trivy/env-config.js';
import { trivyStatusTracker } from './trivy/state.js';
import { TrivyDetectionManager } from './trivy/detection-manager.js';
import { runWorkloadImageScanCycle } from './trivy/workload-scan-cycle.js';
import { SchemaManager } from './database/schema.js';
import { KubernetesEventWatcher } from './events/kubernetes-event-watcher.js';
import { EventQueueWorker } from './events/queue-worker.js';
import { registerEventWatcher } from './events/health.js';
import {
  runScheduledAssessmentTick,
  getScheduledAssessmentLastRunSnapshot,
} from './assessment/scheduled-tick.js';

// Module-level references for shutdown handler
let statusWriterInstance: StatusWriter | null = null;
let collectionSchedulerInstance: CollectionScheduler | null = null;
let argoCDDetectionManagerInstance: ArgoCDDetectionManager | null = null;
let trivyDetectionManagerInstance: TrivyDetectionManager | null = null;
let eventWatcherInstance: KubernetesEventWatcher | null = null;
let eventQueueWorkerInstance: EventQueueWorker | null = null;

/** HTTP port for health/metrics server (default 8080). */
function resolveHealthPort(): number {
  const raw = process.env.HEALTH_PORT;
  if (raw === undefined || raw === '') {
    return 8080;
  }
  const port = parseInt(raw, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid HEALTH_PORT: ${raw} (expected integer 1-65535)`);
  }
  return port;
}

// Load configuration
async function initializeConfig(): Promise<Config> {
  try {
    logger.info('Loading configuration...');
    const config = await loadConfig();
    setConfig(config);
    
    // Log config loaded (without sensitive data)
    logger.info('Configuration loaded', {
      logLevel: config.logLevel,
      statusUpdateIntervalSeconds: config.statusUpdateIntervalSeconds,
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

// Perform initial ArgoCD detection during startup
async function performInitialArgoCDDetection(): Promise<void> {
  try {
    logger.info('Performing initial ArgoCD detection');
    const argoCDConfig = parseArgoCDConfigFromEnv();
    const argoCDStatus = await detectArgoCDWithTimeout(kubernetesClient, argoCDConfig);
    argocdStatusTracker.setStatus(argoCDStatus);
    
    if (argoCDStatus.detected) {
      logger.info('ArgoCD detection completed', {
        detected: true,
        namespace: argoCDStatus.namespace,
        version: argoCDStatus.version
      });
    } else {
      logger.info('ArgoCD detection completed', {
        detected: false
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('ArgoCD detection failed during startup', { error: errorMessage });
    // Continue with default status (not detected)
  }
}

async function performInitialTrivyDetection(): Promise<void> {
  try {
    logger.info('Performing initial Trivy detection');
    const trivyConfig = parseTrivyDetectionConfigFromEnv();
    const trivyStatus = await detectTrivyWithTimeout(trivyConfig);
    trivyStatusTracker.setStatus(trivyStatus);

    if (trivyStatus.detected) {
      logger.info('Trivy detection completed', {
        detected: true,
        serverUrl: trivyStatus.serverUrl,
        version: trivyStatus.version
      });
    } else {
      logger.info('Trivy detection completed', { detected: false });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Trivy detection failed during startup', { error: errorMessage });
  }
}

/**
 * Start the operator control loop
 */
export async function startOperator() {
  try {
    logger.info('kube9-operator starting...');
    
    // Load config first
    const config = await initializeConfig();
    
    // Start health server early so probes are available during initialization
    startHealthServer(resolveHealthPort());
    
    // Initialize database schema for events
    logger.info('Initializing database schema...');
    const schemaManager = new SchemaManager();
    schemaManager.initialize();
    
    // Start event system
    logger.info('Starting event system...');
    const eventQueueWorker = new EventQueueWorker();
    eventQueueWorker.start();
    eventQueueWorkerInstance = eventQueueWorker;
    
    const eventWatcher = new KubernetesEventWatcher();
    await eventWatcher.start();
    eventWatcherInstance = eventWatcher;
    
    // Register event watcher for health checks
    registerEventWatcher(eventWatcher);
    
    logger.info('Event system started');
    
    // Test Kubernetes client
    await testKubernetesClient();
    
    // Perform initial ArgoCD detection before starting status writer
    await performInitialArgoCDDetection();
    
    // Start periodic ArgoCD detection manager
    const argoCDConfig = parseArgoCDConfigFromEnv();
    const initialArgoCDStatus = argocdStatusTracker.getStatus();
    const argoCDDetectionManager = new ArgoCDDetectionManager();
    argoCDDetectionManager.start(kubernetesClient, argoCDConfig, initialArgoCDStatus);
    argoCDDetectionManagerInstance = argoCDDetectionManager;

    await performInitialTrivyDetection();

    const trivyConfig = parseTrivyDetectionConfigFromEnv();
    const initialTrivyStatus = trivyStatusTracker.getStatus();
    const trivyDetectionManager = new TrivyDetectionManager();
    trivyDetectionManager.start(trivyConfig, initialTrivyStatus);
    trivyDetectionManagerInstance = trivyDetectionManager;
    
    // Start status writer for periodic ConfigMap updates
    logger.info('Starting status writer...');
    const statusWriter = new StatusWriter(
      kubernetesClient,
      config.statusUpdateIntervalSeconds
    );
    statusWriter.start();
    
    // Store reference for shutdown handler
    statusWriterInstance = statusWriter;
    
    // Initialize collection scheduler
    logger.info('Initializing collection scheduler...');

    try {
      const collectionScheduler = new CollectionScheduler();
      logger.info('Collection scheduler created successfully');

      // Initialize collection infrastructure
      const localStorage = new LocalStorage();

      // Initialize cluster metadata collector
      const clusterMetadataCollector = new ClusterMetadataCollector(kubernetesClient, localStorage);
    
    // Register cluster metadata collection task
    collectionScheduler.register(
      'cluster-metadata',
      config.clusterMetadataIntervalSeconds,
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
          collectionStatsTracker.recordSuccess('cluster-metadata');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Cluster metadata collection failed', { error: errorMessage });
          
          // Record failed collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('cluster-metadata', 'failed', durationSeconds);
          collectionStatsTracker.recordFailure('cluster-metadata');
          // Don't throw - scheduler will retry on next interval
        }
      }
    );
    
    // Initialize resource inventory collector
    const resourceInventoryCollector = new ResourceInventoryCollector(kubernetesClient, localStorage);
    
    // Register resource inventory collection task
    collectionScheduler.register(
      'resource-inventory',
      config.resourceInventoryIntervalSeconds,
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
          collectionStatsTracker.recordSuccess('resource-inventory');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Resource inventory collection failed', { error: errorMessage });
          
          // Record failed collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('resource-inventory', 'failed', durationSeconds);
          collectionStatsTracker.recordFailure('resource-inventory');
          // Don't throw - scheduler will retry on next interval
        }
      }
    );
    
    // Initialize resource configuration patterns collector
    const resourceConfigurationPatternsCollector = new ResourceConfigurationPatternsCollector(
      kubernetesClient,
      localStorage
    );
    
    // Register resource configuration patterns collection task
    collectionScheduler.register(
      'resource-configuration-patterns',
      config.resourceConfigurationPatternsIntervalSeconds,
      3600,  // 1 hour minimum interval
      3600,  // 0-1 hour random offset range
      async () => {
        const startTime = Date.now();
        try {
          const data = await resourceConfigurationPatternsCollector.collect();
          await resourceConfigurationPatternsCollector.processCollection(data);
          
          // Record successful collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('resource-configuration-patterns', 'success', durationSeconds);
          collectionStatsTracker.recordSuccess('resource-configuration-patterns');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Resource configuration patterns collection failed', { error: errorMessage });
          
          // Record failed collection
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('resource-configuration-patterns', 'failed', durationSeconds);
          collectionStatsTracker.recordFailure('resource-configuration-patterns');
          // Don't throw - scheduler will retry on next interval
        }
      }
    );

    collectionScheduler.register(
      'argocd-application-status',
      config.argoCdApplicationStatusIntervalSeconds,
      1800,
      1800,
      async () => {
        const startTime = Date.now();
        if (!argocdStatusTracker.getStatus().detected) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('argocd-application-status', 'success', durationSeconds);
          collectionStatsTracker.recordSuccess('argocd-application-status');
          return;
        }
        await runApplicationDriftCycle(collectApplicationSnapshots);
        const durationSeconds = (Date.now() - startTime) / 1000;
        recordCollection('argocd-application-status', 'success', durationSeconds);
        collectionStatsTracker.recordSuccess('argocd-application-status');
      }
    );

    collectionScheduler.register(
      'workload-image-scan',
      config.workloadImageScanIntervalSeconds,
      3600, // 1 hour minimum interval
      3600, // 0-1 hour random offset range
      async () => {
        const startTime = Date.now();
        try {
          await runWorkloadImageScanCycle({
            kubernetesClient,
            getTrivyStatus: () => trivyStatusTracker.getStatus(),
          });
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('workload-image-scan', 'success', durationSeconds);
          collectionStatsTracker.recordSuccess('workload-image-scan');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Workload image collection or scan cycle failed', { error: errorMessage });
          const durationSeconds = (Date.now() - startTime) / 1000;
          recordCollection('workload-image-scan', 'failed', durationSeconds);
          collectionStatsTracker.recordFailure('workload-image-scan');
        }
      }
    );

    if (config.assessmentEnabled) {
      collectionScheduler.register(
        'well-architected-assessment',
        config.assessmentIntervalSeconds,
        3600,
        3600,
        async () => {
          const startTime = Date.now();
          try {
            await runScheduledAssessmentTick({
              kubernetes: kubernetesClient,
              config,
              logger,
              getTrivyStatus: () => trivyStatusTracker.getStatus(),
            });
            const durationSeconds = (Date.now() - startTime) / 1000;
            const snap = getScheduledAssessmentLastRunSnapshot();
            const tickOk = snap?.outcome !== 'failed';
            recordCollection(
              'well-architected-assessment',
              tickOk ? 'success' : 'failed',
              durationSeconds
            );
            if (tickOk) {
              collectionStatsTracker.recordSuccess('well-architected-assessment');
            } else {
              collectionStatsTracker.recordFailure('well-architected-assessment');
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Scheduled assessment tick failed unexpectedly', { error: errorMessage });
            const durationSeconds = (Date.now() - startTime) / 1000;
            recordCollection('well-architected-assessment', 'failed', durationSeconds);
            collectionStatsTracker.recordFailure('well-architected-assessment');
          }
        }
      );
    }
    
      // Start scheduler
      collectionScheduler.start();

      // Store reference for shutdown handler
      collectionSchedulerInstance = collectionScheduler;

      logger.info('Collection initialization completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize collection system', { error: errorMessage });
      // Continue without collection - operator can still function for status reporting
    }
    
    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', () => {
      if (statusWriterInstance) {
        gracefulShutdown(
          statusWriterInstance,
          collectionSchedulerInstance,
          argoCDDetectionManagerInstance,
          trivyDetectionManagerInstance,
          eventWatcherInstance,
          eventQueueWorkerInstance
        ).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error in shutdown handler', { error: errorMessage });
          process.exit(1);
        });
      }
    });
    
    process.on('SIGINT', () => {
      if (statusWriterInstance) {
        gracefulShutdown(
          statusWriterInstance,
          collectionSchedulerInstance,
          argoCDDetectionManagerInstance,
          trivyDetectionManagerInstance,
          eventWatcherInstance,
          eventQueueWorkerInstance
        ).catch((error) => {
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

