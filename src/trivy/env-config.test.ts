/**
 * Tests for Trivy env parsing shared by operator and assess CLI.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseTrivyDetectionConfigFromEnv } from './env-config.js';

describe('parseTrivyDetectionConfigFromEnv', () => {
  const envKeys = [
    'TRIVY_AUTO_DETECT',
    'TRIVY_ENABLED',
    'TRIVY_SERVER_URL',
    'TRIVY_HEALTH_PATH',
    'TRIVY_DETECTION_INTERVAL',
    'TRIVY_DETECTION_TIMEOUT_MS',
  ] as const;

  beforeEach(() => {
    for (const k of envKeys) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      delete process.env[k];
    }
  });

  it('uses defaults when env is unset', () => {
    const c = parseTrivyDetectionConfigFromEnv();
    expect(c.autoDetect).toBe(true);
    expect(c.healthPath).toBe('/healthz');
    expect(c.detectionInterval).toBe(6);
    expect(c.detectionTimeoutMs).toBe(10000);
    expect(c.serverUrl).toBeUndefined();
    expect(c.enabled).toBeUndefined();
  });

  it('parses explicit server URL and disables autoDetect', () => {
    process.env.TRIVY_SERVER_URL = ' http://trivy:4954 ';
    process.env.TRIVY_AUTO_DETECT = 'false';
    process.env.TRIVY_ENABLED = 'true';
    const c = parseTrivyDetectionConfigFromEnv();
    expect(c.serverUrl).toBe('http://trivy:4954');
    expect(c.autoDetect).toBe(false);
    expect(c.enabled).toBe(true);
  });
});
