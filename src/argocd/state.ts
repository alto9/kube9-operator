/**
 * ArgoCD status state tracker
 * 
 * Tracks ArgoCD detection status for inclusion in operator status.
 * Provides a simple in-memory store of ArgoCD detection state that can be
 * exported to the operator status ConfigMap.
 */

import type { ArgoCDStatus } from '../status/types.js';

/**
 * Default ArgoCD status when detection has not yet been performed
 */
const DEFAULT_ARGOCD_STATUS: ArgoCDStatus = {
  detected: false,
  namespace: null,
  version: null,
  lastChecked: new Date().toISOString(),
};

/**
 * ArgoCDStatusTracker maintains the current ArgoCD detection status
 * that can be included in operator status updates.
 */
export class ArgoCDStatusTracker {
  private status: ArgoCDStatus = { ...DEFAULT_ARGOCD_STATUS };

  /**
   * Gets current ArgoCD status
   * Returns a copy to prevent external mutations
   * 
   * @returns Current ArgoCD status
   */
  getStatus(): ArgoCDStatus {
    return { ...this.status };
  }

  /**
   * Updates ArgoCD status with new detection result
   * 
   * @param status - New ArgoCD status from detection
   */
  setStatus(status: ArgoCDStatus): void {
    this.status = { ...status };
  }

  /**
   * Resets status to default (useful for testing)
   */
  reset(): void {
    this.status = { ...DEFAULT_ARGOCD_STATUS };
  }
}

/**
 * Singleton instance of the ArgoCD status tracker
 */
export const argocdStatusTracker = new ArgoCDStatusTracker();



