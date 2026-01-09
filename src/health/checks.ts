import * as k8s from '@kubernetes/client-node';
import { kubernetesClient } from '../kubernetes/client.js';
import { getInitialized } from './state.js';
import { getEventListenerHealth } from '../events/health.js';
import { logger } from '../logging/logger.js';

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  message: string;
}

/**
 * Namespace for health check ConfigMap
 * Uses POD_NAMESPACE environment variable (set by Helm via downward API)
 * Falls back to 'kube9-system' for backwards compatibility
 */
const HEALTH_CHECK_NAMESPACE = process.env.POD_NAMESPACE || 'kube9-system';

/**
 * Name of the test ConfigMap used for readiness checks
 */
const HEALTH_CHECK_CONFIGMAP_NAME = 'kube9-operator-health-check';

/**
 * Timeout for health checks in milliseconds (5 seconds)
 */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Test ConfigMap write capability by attempting to create/update a test ConfigMap
 * 
 * @param coreApi - Kubernetes CoreV1Api client
 * @returns Promise resolving to true if ConfigMap write succeeds, false otherwise
 */
async function testConfigMapWrite(coreApi: k8s.CoreV1Api): Promise<boolean> {
  try {
    // Create a minimal test ConfigMap
    const testConfigMap: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: HEALTH_CHECK_CONFIGMAP_NAME,
        namespace: HEALTH_CHECK_NAMESPACE,
        labels: {
          'app.kubernetes.io/name': 'kube9-operator',
          'app.kubernetes.io/component': 'health-check',
        },
      },
      data: {
        timestamp: new Date().toISOString(),
      },
    };

    try {
      // Try to read existing ConfigMap
      await coreApi.readNamespacedConfigMap({
        name: HEALTH_CHECK_CONFIGMAP_NAME,
        namespace: HEALTH_CHECK_NAMESPACE
      });
      
      // ConfigMap exists, update it
      await coreApi.replaceNamespacedConfigMap({
        name: HEALTH_CHECK_CONFIGMAP_NAME,
        namespace: HEALTH_CHECK_NAMESPACE,
        body: testConfigMap
      });
    } catch (error: unknown) {
      // Check if error is 404 (not found)
      // kubernetes-client-node throws errors with a 'code' property for HTTP status codes
      const httpError = error as { code?: number; statusCode?: number };
      if (httpError.code === 404 || httpError.statusCode === 404) {
        // ConfigMap doesn't exist, create it
        await coreApi.createNamespacedConfigMap({
          namespace: HEALTH_CHECK_NAMESPACE,
          body: testConfigMap
        });
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    return true;
  } catch (error) {
    // ConfigMap write failed - log the error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Health check ConfigMap write failed', { 
      error: errorMessage,
      namespace: HEALTH_CHECK_NAMESPACE,
      configMapName: HEALTH_CHECK_CONFIGMAP_NAME 
    });
    return false;
  }
}

/**
 * Check liveness - verifies that the Kubernetes client is accessible
 * 
 * This is a lightweight check that verifies the operator can communicate
 * with the Kubernetes API server and that the event system is not stalled.
 * Used by the liveness probe.
 * 
 * @returns Promise resolving to health check result
 */
export async function checkLiveness(): Promise<HealthCheckResult> {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    // Race between cluster info check and timeout
    await Promise.race([
      kubernetesClient.getClusterInfo(),
      timeoutPromise,
    ]);

    // Check that event listener is watching (not stalled)
    const eventHealth = getEventListenerHealth();
    if (!eventHealth.details.isWatching) {
      return {
        healthy: false,
        message: 'Not healthy: Event listener not watching',
      };
    }

    return {
      healthy: true,
      message: 'OK',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      healthy: false,
      message: `Not healthy: ${errorMessage}`,
    };
  }
}

/**
 * Check readiness - verifies that the operator is initialized and can write ConfigMaps
 * 
 * This check verifies:
 * 1. Operator has completed initialization
 * 2. Operator can write ConfigMaps (validates RBAC permissions and cluster connectivity)
 * 3. Event listener is operational
 * 
 * Used by the readiness probe to determine if the operator is ready to serve traffic.
 * 
 * @returns Promise resolving to health check result
 */
export async function checkReadiness(): Promise<HealthCheckResult> {
  // First check if operator is initialized
  if (!getInitialized()) {
    return {
      healthy: false,
      message: 'Not ready: Operator not initialized',
    };
  }

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Readiness check timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    // Race between ConfigMap write test and timeout
    const canWrite = await Promise.race([
      testConfigMapWrite(kubernetesClient.coreApi),
      timeoutPromise,
    ]);

    if (!canWrite) {
      return {
        healthy: false,
        message: 'Not ready: Cannot write ConfigMap',
      };
    }

    // Check event listener health
    const eventHealth = getEventListenerHealth();
    if (!eventHealth.healthy) {
      return {
        healthy: false,
        message: `Not ready: ${eventHealth.message}`,
      };
    }

    return {
      healthy: true,
      message: 'Ready',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      healthy: false,
      message: `Not ready: ${errorMessage}`,
    };
  }
}

