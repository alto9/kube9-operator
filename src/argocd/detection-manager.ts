/**
 * ArgoCD periodic detection manager
 * 
 * Manages periodic re-checking of ArgoCD installation status to detect
 * installations/uninstallations that occur after operator startup.
 */

import { logger } from '../logging/logger.js';
import { KubernetesClient } from '../kubernetes/client.js';
import { detectArgoCDWithTimeout, type ArgoCDDetectionConfig } from './detection.js';
import { argocdStatusTracker } from './state.js';
import type { ArgoCDStatus } from '../status/types.js';

/**
 * ArgoCDDetectionManager handles periodic detection of ArgoCD installation
 * and updates the status tracker only when detection results change.
 */
export class ArgoCDDetectionManager {
  private intervalHandle: NodeJS.Timeout | null = null;
  private currentStatus: ArgoCDStatus;

  /**
   * Starts periodic ArgoCD detection
   * 
   * Sets up an interval to periodically check for ArgoCD installation.
   * Updates status tracker only when detection result changes.
   * 
   * @param k8sClient - Kubernetes client for API access
   * @param config - ArgoCD detection configuration
   * @param initialStatus - Initial ArgoCD status from startup detection
   */
  start(
    k8sClient: KubernetesClient,
    config: ArgoCDDetectionConfig,
    initialStatus: ArgoCDStatus
  ): void {
    this.currentStatus = initialStatus;
    const intervalMs = config.detectionInterval * 60 * 60 * 1000; // hours to ms
    
    this.intervalHandle = setInterval(
      () => this.performPeriodicCheck(k8sClient, config),
      intervalMs
    );
    
    logger.info("ArgoCD periodic detection started", {
      intervalHours: config.detectionInterval
    });
  }

  /**
   * Stops periodic ArgoCD detection
   * 
   * Clears the interval and logs shutdown.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info("ArgoCD periodic detection stopped");
    }
  }

  /**
   * Performs a periodic check for ArgoCD installation
   * 
   * Compares new detection result with current status and updates
   * the status tracker only if the result changed.
   * 
   * @param k8sClient - Kubernetes client for API access
   * @param config - ArgoCD detection configuration
   */
  private async performPeriodicCheck(
    k8sClient: KubernetesClient,
    config: ArgoCDDetectionConfig
  ): Promise<void> {
    try {
      logger.debug("Performing periodic ArgoCD detection");
      const newStatus = await detectArgoCDWithTimeout(k8sClient, config);
      
      // Check if status changed
      if (this.hasStatusChanged(newStatus)) {
        logger.info("ArgoCD status changed", {
          previous: {
            detected: this.currentStatus.detected,
            namespace: this.currentStatus.namespace,
            version: this.currentStatus.version
          },
          current: {
            detected: newStatus.detected,
            namespace: newStatus.namespace,
            version: newStatus.version
          }
        });
        
        this.currentStatus = newStatus;
        // Update status tracker - StatusWriter will pick this up automatically
        argocdStatusTracker.setStatus(newStatus);
      } else {
        logger.debug("ArgoCD status unchanged, skipping update");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Periodic ArgoCD detection failed", { error: errorMessage });
    }
  }

  /**
   * Checks if ArgoCD status has changed
   * 
   * Compares relevant fields between current and new status.
   * 
   * @param newStatus - New ArgoCD status to compare
   * @returns true if status changed, false otherwise
   */
  private hasStatusChanged(newStatus: ArgoCDStatus): boolean {
    return (
      this.currentStatus.detected !== newStatus.detected ||
      this.currentStatus.namespace !== newStatus.namespace ||
      this.currentStatus.version !== newStatus.version
    );
  }
}

