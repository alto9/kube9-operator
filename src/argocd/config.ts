/**
 * ArgoCD configuration parsing from environment variables
 */

import type { ArgoCDDetectionConfig } from './detection.js';

/**
 * Parse ArgoCD configuration from environment variables
 *
 * @returns ArgoCDDetectionConfig with values from env
 */
export function parseArgoCDConfig(): ArgoCDDetectionConfig {
  return {
    autoDetect: process.env.ARGOCD_AUTO_DETECT !== 'false',
    enabled: process.env.ARGOCD_ENABLED === 'true' ? true : undefined,
    namespace: process.env.ARGOCD_NAMESPACE || 'argocd',
    selector: process.env.ARGOCD_SELECTOR || 'app.kubernetes.io/name=argocd-server',
    endpointOverride: process.env.ARGOCD_ENDPOINT_OVERRIDE || undefined,
    detectionInterval: parseInt(process.env.ARGOCD_DETECTION_INTERVAL || '6', 10),
  };
}
