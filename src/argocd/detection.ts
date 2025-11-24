/**
 * ArgoCD detection module
 * 
 * Detects ArgoCD installation in the cluster by checking for:
 * - Application CRD (applications.argoproj.io)
 * - ArgoCD server deployment in target namespace
 */

import * as k8s from '@kubernetes/client-node';
import { logger } from '../logging/logger.js';
import { KubernetesClient } from '../kubernetes/client.js';
import type { ArgoCDStatus } from '../status/types.js';

/**
 * ArgoCD detection configuration
 * Controls how and when ArgoCD detection occurs
 */
export interface ArgoCDDetectionConfig {
  /**
   * Enable automatic ArgoCD detection
   * When false, detection is completely disabled
   */
  autoDetect: boolean;
  
  /**
   * Explicitly enable or disable ArgoCD integration
   * When set, this overrides autoDetect
   */
  enabled?: boolean;
  
  /**
   * Custom namespace where ArgoCD is installed
   * Defaults to "argocd" if not specified
   */
  namespace?: string;
  
  /**
   * Custom label selector for ArgoCD server deployment
   * Defaults to "app.kubernetes.io/name=argocd-server" if not specified
   */
  selector?: string;
  
  /**
   * Detection check interval in hours
   * How often to re-check ArgoCD presence
   */
  detectionInterval: number;
}

/**
 * Check if ArgoCD Application CRD exists in the cluster
 * 
 * @param k8sClient - Kubernetes client for API access
 * @returns Promise resolving to true if CRD exists, false otherwise
 */
async function checkForApplicationCRD(k8sClient: KubernetesClient): Promise<boolean> {
  try {
    const crd = await k8sClient.apiextensionsApi.readCustomResourceDefinition(
      "applications.argoproj.io"
    );
    return crd !== null;
  } catch (error: unknown) {
    const errorObj = error as { response?: { statusCode?: number } };
    if (errorObj.response?.statusCode === 404) {
      return false;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn("Error checking for ArgoCD CRD", { error: errorMessage });
    return false;
  }
}

/**
 * Extract ArgoCD version from deployment labels or image tags
 * 
 * Checks deployment labels first (more reliable), then falls back to
 * parsing the container image tag. Returns null if version cannot be determined.
 * 
 * @param deployment - Kubernetes deployment object
 * @returns Version string (e.g., "v2.8.0") or null if not found
 */
function extractVersion(deployment: k8s.V1Deployment): string | null {
  // Try to get version from labels
  const labels = deployment.metadata?.labels || {};
  
  // Check common version label patterns in priority order
  const versionLabels = [
    "app.kubernetes.io/version",
    "argocd.argoproj.io/version",
    "version"
  ];
  
  for (const labelKey of versionLabels) {
    if (labels[labelKey]) {
      return labels[labelKey];
    }
  }
  
  // Try to extract from image tag
  const containers = deployment.spec?.template?.spec?.containers || [];
  const argoCDContainer = containers.find(c => 
    c.name === "argocd-server" || c.image?.includes("argocd")
  );
  
  if (argoCDContainer?.image) {
    const imageMatch = argoCDContainer.image.match(/:v?(\d+\.\d+\.\d+)/);
    if (imageMatch) {
      return `v${imageMatch[1]}`;
    }
  }
  
  // Version could not be determined
  logger.debug("Could not determine ArgoCD version from deployment labels or image");
  return null;
}

/**
 * Detect ArgoCD in a specific namespace
 * 
 * Checks if namespace exists and contains ArgoCD server deployment
 * matching the provided label selector.
 * 
 * @param k8sClient - Kubernetes client for API access
 * @param namespace - Namespace to check for ArgoCD
 * @param selector - Label selector for ArgoCD server deployment
 * @param timestamp - ISO 8601 timestamp for lastChecked field
 * @returns Promise resolving to ArgoCDStatus
 */
async function detectInNamespace(
  k8sClient: KubernetesClient,
  namespace: string,
  selector: string,
  timestamp: string
): Promise<ArgoCDStatus> {
  try {
    // Check if namespace exists
    const ns = await k8sClient.coreApi.readNamespace(namespace);
    if (!ns) {
      return {
        detected: false,
        namespace: null,
        version: null,
        lastChecked: timestamp
      };
    }
    
    // Check for ArgoCD server deployment
    const deployments = await k8sClient.appsApi.listNamespacedDeployment(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      selector
    );
    
    if (deployments.body.items.length === 0) {
      return {
        detected: false,
        namespace: null,
        version: null,
        lastChecked: timestamp
      };
    }
    
    // Extract version from deployment
    const deployment = deployments.body.items[0];
    const version = extractVersion(deployment);
    
    return {
      detected: true,
      namespace,
      version,
      lastChecked: timestamp
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn("Error detecting ArgoCD in namespace", { namespace, error: errorMessage });
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: timestamp
    };
  }
}

/**
 * Main ArgoCD detection function
 * 
 * Orchestrates detection logic based on configuration precedence:
 * - enabled: false or autoDetect: false → detection disabled
 * - enabled: true → skip CRD check, go directly to namespace
 * - Default → check CRD first, then namespace if CRD exists
 * 
 * @param k8sClient - Kubernetes client for API access
 * @param config - ArgoCD detection configuration
 * @returns Promise resolving to ArgoCDStatus
 */
export async function detectArgoCD(
  k8sClient: KubernetesClient,
  config: ArgoCDDetectionConfig
): Promise<ArgoCDStatus> {
  const now = new Date().toISOString();
  
  // Check 1: Is detection disabled?
  if (config.enabled === false || config.autoDetect === false) {
    logger.debug("ArgoCD detection disabled via configuration");
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: now
    };
  }
  
  // Check 2: Is ArgoCD explicitly enabled?
  if (config.enabled === true) {
    logger.debug("ArgoCD explicitly enabled, bypassing CRD check");
    return await detectInNamespace(
      k8sClient,
      config.namespace || "argocd",
      config.selector || "app.kubernetes.io/name=argocd-server",
      now
    );
  }
  
  // Check 3: Auto-detect with CRD check
  logger.debug("Checking for ArgoCD Application CRD");
  const hasCRD = await checkForApplicationCRD(k8sClient);
  if (!hasCRD) {
    logger.info("ArgoCD not detected in cluster (no Application CRD)");
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: now
    };
  }
  
  // Check 4: Verify deployment in namespace
  logger.debug("Application CRD found, checking for ArgoCD deployment");
  const result = await detectInNamespace(
    k8sClient,
    config.namespace || "argocd",
    config.selector || "app.kubernetes.io/name=argocd-server",
    now
  );
  
  if (result.detected) {
    logger.info("ArgoCD detected", {
      namespace: result.namespace,
      version: result.version
    });
  } else {
    logger.info("ArgoCD not detected in cluster");
  }
  
  return result;
}

/**
 * ArgoCD detection with timeout protection
 * 
 * Wraps detectArgoCD() with a timeout to prevent detection from blocking
 * operator startup indefinitely. If detection exceeds the timeout, returns
 * detected: false with a warning log.
 * 
 * @param k8sClient - Kubernetes client for API access
 * @param config - ArgoCD detection configuration
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise resolving to ArgoCDStatus
 */
export async function detectArgoCDWithTimeout(
  k8sClient: KubernetesClient,
  config: ArgoCDDetectionConfig,
  timeoutMs: number = 30000
): Promise<ArgoCDStatus> {
  const timeoutPromise = new Promise<ArgoCDStatus>((resolve) => {
    setTimeout(() => {
      logger.warn("ArgoCD detection timed out", { timeoutMs });
      resolve({
        detected: false,
        namespace: null,
        version: null,
        lastChecked: new Date().toISOString()
      });
    }, timeoutMs);
  });
  
  return Promise.race([
    detectArgoCD(k8sClient, config),
    timeoutPromise
  ]);
}

/**
 * Export detection functions for use in other modules
 */
export { checkForApplicationCRD, detectInNamespace, extractVersion };

