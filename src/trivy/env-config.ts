/**
 * Parse Trivy HTTP detection settings from process.env (operator and CLI).
 */

import type { TrivyDetectionConfig } from './detection.js';

export function parseTrivyDetectionConfigFromEnv(): TrivyDetectionConfig {
  const enabledEnv = process.env.TRIVY_ENABLED;
  return {
    autoDetect: process.env.TRIVY_AUTO_DETECT !== 'false',
    enabled:
      enabledEnv === 'true' ? true : enabledEnv === 'false' ? false : undefined,
    serverUrl: process.env.TRIVY_SERVER_URL?.trim() || undefined,
    healthPath: process.env.TRIVY_HEALTH_PATH || '/healthz',
    detectionInterval: parseInt(process.env.TRIVY_DETECTION_INTERVAL || '6', 10),
    detectionTimeoutMs: parseInt(process.env.TRIVY_DETECTION_TIMEOUT_MS || '10000', 10),
  };
}
