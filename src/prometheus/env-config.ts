/**
 * Parse optional Prometheus outbound client settings from environment.
 * Unset PROMETHEUS_BASE_URL is a soft miss (returns undefined).
 */

import type { PrometheusClientConfig } from './types.js';

const PROMETHEUS_TIMEOUT_MIN_MS = 1000;

function parsePositiveInt(
  envName: string,
  raw: string | undefined,
  defaultValue: string,
  minInclusive: number
): number {
  const s = raw !== undefined && raw !== '' ? raw : defaultValue;
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n < minInclusive) {
    throw new Error(
      `${envName} must be an integer >= ${minInclusive}${raw !== undefined && raw !== '' ? ` (got "${raw}")` : ''}`
    );
  }
  return n;
}

function parseEnvBool(raw: string | undefined, defaultValue: boolean, envName: string): boolean {
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(v)) {
    return false;
  }
  throw new Error(`Invalid boolean for ${envName}: "${raw}" (use true/false, 1/0, yes/no)`);
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function assertValidHttpUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`PROMETHEUS_BASE_URL must be a valid http or https URL (got "${baseUrl}")`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `PROMETHEUS_BASE_URL must use http or https scheme (got "${parsed.protocol}")`
    );
  }
}

/**
 * Returns Prometheus client config when PROMETHEUS_BASE_URL is non-empty; otherwise undefined.
 * Malformed URL or invalid timeout when URL is set fails config load.
 */
export function parsePrometheusConfigFromEnv(): PrometheusClientConfig | undefined {
  const baseUrl = normalizeBaseUrl(process.env.PROMETHEUS_BASE_URL ?? '');
  if (!baseUrl) {
    return undefined;
  }

  assertValidHttpUrl(baseUrl);

  return {
    baseUrl,
    timeoutMs: parsePositiveInt(
      'PROMETHEUS_TIMEOUT_MS',
      process.env.PROMETHEUS_TIMEOUT_MS,
      '30000',
      PROMETHEUS_TIMEOUT_MIN_MS
    ),
    tlsInsecure: parseEnvBool(process.env.PROMETHEUS_TLS_INSECURE, false, 'PROMETHEUS_TLS_INSECURE'),
  };
}
