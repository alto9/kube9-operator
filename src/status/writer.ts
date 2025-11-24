import * as k8s from '@kubernetes/client-node';
import { kubernetesClient, KubernetesClient } from '../kubernetes/client.js';
import { calculateStatus } from './calculator.js';
import type { OperatorStatus, RegistrationState } from './types.js';
import type { RegistrationManager } from '../registration/manager.js';
import { logger } from '../logging/logger.js';
import { collectionStatsTracker } from '../collection/stats-tracker.js';
import { argocdStatusTracker } from '../argocd/state.js';

/**
 * Default registration state when registration manager is not available
 */
const DEFAULT_REGISTRATION_STATE: RegistrationState = {
  isRegistered: false,
  clusterId: undefined,
  consecutiveFailures: 0,
};

/**
 * ConfigMap name for operator status
 */
const STATUS_CONFIGMAP_NAME = 'kube9-operator-status';

/**
 * Namespace for operator status ConfigMap
 */
const STATUS_NAMESPACE = 'kube9-system';

/**
 * Creates or updates a ConfigMap in the specified namespace
 * 
 * @param namespace - Kubernetes namespace
 * @param name - ConfigMap name
 * @param data - Data to store in ConfigMap
 * @param labels - Labels to apply to ConfigMap
 * @returns Promise that resolves when ConfigMap is created/updated
 * @throws Error if ConfigMap operations fail
 */
async function createOrUpdateConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>,
  labels: Record<string, string>,
  coreApi: k8s.CoreV1Api
): Promise<void> {

  // Create ConfigMap object with proper structure
  const configMap: k8s.V1ConfigMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name,
      namespace,
      labels,
    },
    data,
  };

  try {
    // Try to read existing ConfigMap
    await coreApi.readNamespacedConfigMap(name, namespace);
    
    // ConfigMap exists, update it
    await coreApi.replaceNamespacedConfigMap(name, namespace, configMap);
  } catch (error: unknown) {
    // Check if error is 404 (not found)
    const errorObj = error as { response?: { statusCode?: number } };
    if (errorObj.response?.statusCode === 404) {
      // ConfigMap doesn't exist, create it
      await coreApi.createNamespacedConfigMap(namespace, configMap);
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}

/**
 * StatusWriter manages periodic updates of operator status to a ConfigMap
 */
export class StatusWriter {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly kubernetesClient: KubernetesClient;
  private readonly intervalSeconds: number;
  private readonly registrationManager?: RegistrationManager;
  private lastWriteError: string | null = null;

  /**
   * Creates a new StatusWriter instance
   * 
   * @param client - Kubernetes client instance (defaults to singleton)
   * @param intervalSeconds - Update interval in seconds (defaults to 60)
   * @param registrationManager - Optional registration manager for registration state
   */
  constructor(
    client?: KubernetesClient,
    intervalSeconds: number = 60,
    registrationManager?: RegistrationManager
  ) {
    // Use provided client or fall back to singleton
    this.kubernetesClient = client ?? kubernetesClient;
    this.intervalSeconds = intervalSeconds;
    this.registrationManager = registrationManager;
  }

  /**
   * Starts periodic status updates
   */
  start(): void {
    if (this.intervalId !== null) {
      logger.warn('StatusWriter is already running');
      return;
    }

    logger.info('Starting status writer', { intervalSeconds: this.intervalSeconds });
    
    // Perform initial update immediately
    this.updateStatus().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Initial status update failed', { error: errorMessage });
    });

    // Set up periodic updates
    this.intervalId = setInterval(() => {
      this.updateStatus().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Periodic status update failed', { error: errorMessage });
      });
    }, this.intervalSeconds * 1000);
  }

  /**
   * Stops periodic status updates
   */
  stop(): void {
    if (this.intervalId === null) {
      return;
    }

    logger.info('Stopping status writer');
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /**
   * Writes a final status update to the ConfigMap
   * Used during graceful shutdown to indicate the operator is shutting down
   * 
   * @param status - Final status to write
   */
  async writeFinalStatus(status: OperatorStatus): Promise<void> {
    try {
      // Convert status to JSON string
      const statusJson = JSON.stringify(status, null, 2);

      // Create or update ConfigMap
      await createOrUpdateConfigMap(
        STATUS_NAMESPACE,
        STATUS_CONFIGMAP_NAME,
        { status: statusJson },
        {
          'app.kubernetes.io/name': 'kube9-operator',
          'app.kubernetes.io/component': 'status',
        },
        this.kubernetesClient.coreApi
      );

      logger.info('Final status update written: shutting down');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Log error but don't throw (non-fatal during shutdown)
      logger.error('Failed to write final status ConfigMap', { error: errorMessage });
    }
  }

  /**
   * Updates the status ConfigMap with current operator status
   * Handles errors gracefully without crashing the operator
   */
  private async updateStatus(): Promise<void> {
    try {
      // Get registration state from manager if available, otherwise use default
      const registrationState = this.registrationManager
        ? this.registrationManager.getState()
        : DEFAULT_REGISTRATION_STATE;
      
      const canWriteConfigMap = true; // Assume we can write unless proven otherwise
      
      // Get current collection statistics
      const collectionStats = collectionStatsTracker.getStats();
      
      // Get current ArgoCD status
      const argocdStatus = argocdStatusTracker.getStatus();
      
      const status = calculateStatus(
        registrationState,
        this.lastWriteError,
        canWriteConfigMap,
        collectionStats,
        argocdStatus
      );

      // Convert status to JSON string
      const statusJson = JSON.stringify(status, null, 2);

      // Create or update ConfigMap
      await createOrUpdateConfigMap(
        STATUS_NAMESPACE,
        STATUS_CONFIGMAP_NAME,
        { status: statusJson },
        {
          'app.kubernetes.io/name': 'kube9-operator',
          'app.kubernetes.io/component': 'status',
        },
        this.kubernetesClient.coreApi
      );

      // Clear any previous write errors on success
      if (this.lastWriteError !== null) {
        this.lastWriteError = null;
        logger.info('Status ConfigMap write recovered from previous error');
      }

      // Log successful update at INFO level
      logger.info('Status updated', {
        mode: status.mode,
        tier: status.tier,
        health: status.health,
        registered: status.registered,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastWriteError = errorMessage;
      
      // Log error but don't throw (non-fatal)
      logger.error('Failed to update status ConfigMap', { error: errorMessage });
      
      // Log additional context for debugging
      if (error instanceof Error && 'response' in error) {
        const k8sError = error as { response?: { statusCode?: number; body?: unknown } };
        if (k8sError.response?.statusCode === 403) {
          logger.error('ConfigMap write forbidden: check RBAC permissions for ConfigMap create/update');
        }
      }
    }
  }
}

