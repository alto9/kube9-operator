/**
 * Optional Trivy server detection via HTTP health endpoint (e.g. GET /healthz).
 */

import { logger } from '../logging/logger.js';
import type { TrivyStatus } from '../status/types.js';

export interface TrivyDetectionConfig {
  autoDetect: boolean;
  enabled?: boolean;
  /** Base URL of the Trivy server (e.g. http://trivy.trivy-system.svc:4954) */
  serverUrl?: string;
  /** Path for HTTP health probe (default /healthz) */
  healthPath: string;
  /** Re-check interval in hours */
  detectionInterval: number;
  /** Per-request timeout for the health probe */
  detectionTimeoutMs: number;
}

function emptyStatus(lastChecked: string): TrivyStatus {
  return {
    detected: false,
    serverUrl: null,
    version: null,
    lastChecked,
  };
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Probe Trivy HTTP health endpoint. Trivy server exposes GET /healthz (200, body "ok") by default.
 */
export async function probeTrivyHealth(
  baseUrl: string,
  healthPath: string,
  timeoutMs: number
): Promise<boolean> {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) {
    return false;
  }
  const path = healthPath.startsWith('/') ? healthPath : `/${healthPath}`;
  const target = new URL(path, `${root}/`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'text/plain, */*' },
    });
    if (!res.ok) {
      logger.debug('Trivy health probe returned non-OK status', {
        status: res.status,
        url: target.href,
      });
      return false;
    }
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.debug('Trivy health probe failed', { url: target.href, error: msg });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Optionally fetch Trivy version from GET /version when present (non-fatal if missing).
 */
async function tryFetchVersion(baseUrl: string, timeoutMs: number): Promise<string | null> {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) {
    return null;
  }
  const target = new URL('/version', `${root}/`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json, text/plain, */*' },
    });
    if (!res.ok) {
      return null;
    }
    const text = (await res.text()).trim();
    if (!text) {
      return null;
    }
    try {
      const parsed = JSON.parse(text) as { Version?: string; version?: string };
      return parsed.Version ?? parsed.version ?? null;
    } catch {
      return text.length > 64 ? `${text.slice(0, 61)}...` : text;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detect whether a Trivy server is reachable at the configured URL.
 */
export async function detectTrivy(config: TrivyDetectionConfig): Promise<TrivyStatus> {
  const now = new Date().toISOString();

  if (config.enabled === false || config.autoDetect === false) {
    logger.debug('Trivy detection disabled via configuration');
    return emptyStatus(now);
  }

  const serverUrl = config.serverUrl?.trim();
  if (!serverUrl) {
    logger.debug('Trivy server URL not set; reporting unavailable');
    return emptyStatus(now);
  }

  if (config.enabled === true) {
    logger.debug('Trivy explicitly enabled, probing configured server URL');
  }

  const ok = await probeTrivyHealth(serverUrl, config.healthPath, config.detectionTimeoutMs);
  if (!ok) {
    logger.info('Trivy not detected or unreachable', { serverUrl });
    return {
      detected: false,
      serverUrl: null,
      version: null,
      lastChecked: now,
    };
  }

  const version = await tryFetchVersion(serverUrl, config.detectionTimeoutMs);
  logger.info('Trivy server detected', { serverUrl, version });
  return {
    detected: true,
    serverUrl: normalizeBaseUrl(serverUrl),
    version,
    lastChecked: now,
  };
}

export async function detectTrivyWithTimeout(
  config: TrivyDetectionConfig,
  timeoutMs?: number
): Promise<TrivyStatus> {
  const outer =
    timeoutMs ?? Math.max(30000, config.detectionTimeoutMs + 2000);

  const timeoutPromise = new Promise<TrivyStatus>((resolve) => {
    setTimeout(() => {
      logger.warn('Trivy detection timed out', { timeoutMs: outer });
      resolve(emptyStatus(new Date().toISOString()));
    }, outer);
  });

  return Promise.race([detectTrivy(config), timeoutPromise]);
}
