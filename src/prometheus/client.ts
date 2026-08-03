/**
 * Minimal Prometheus PromQL instant-query HTTP client (Role B outbound).
 * v1: URL + timeout + TLS only. Never sends operator ServiceAccount credentials.
 */

import { jsonGet } from '../argocd/api-http.js';
import { logger } from '../logging/logger.js';
import type { PromInstantQueryResponse, PrometheusClientConfig } from './types.js';

/** v1 PromQL queries for bounded utilization / ratio aggregates. */
export const PERFORMANCE_PROMQL = {
  cpuClusterAvg: 'avg(1 - rate(node_cpu_seconds_total{mode="idle"}[5m]))',
  cpuNodeHigh: 'max(1 - rate(node_cpu_seconds_total{mode="idle"}[5m]))',
  memoryClusterAvg: '1 - avg(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
  memoryNodeHigh: 'max(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))',
  pendingPodsRatio:
    'sum(kube_pod_status_phase{phase="Pending"}) / clamp_min(sum(kube_pod_status_phase), 1)',
} as const;

export type PerformancePromqlKey = keyof typeof PERFORMANCE_PROMQL;

function buildInstantQueryUrl(baseUrl: string, query: string): string {
  const params = new URLSearchParams({ query });
  return `${baseUrl}/api/v1/query?${params.toString()}`;
}

function parseInstantScalar(response: unknown): number | null {
  if (!response || typeof response !== 'object') {
    return null;
  }
  const body = response as PromInstantQueryResponse;
  if (body.status !== 'success' || !body.data) {
    return null;
  }
  if (body.data.resultType !== 'vector' || !Array.isArray(body.data.result)) {
    return null;
  }
  if (body.data.result.length === 0) {
    return null;
  }
  const entry = body.data.result[0];
  if (!entry?.value || entry.value.length < 2) {
    return null;
  }
  const raw = entry.value[1];
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n)) {
    return null;
  }
  if (n < 0 || n > 1) {
    return null;
  }
  return n;
}

export class PrometheusClient {
  private readonly config: PrometheusClientConfig;

  constructor(config: PrometheusClientConfig) {
    this.config = config;
  }

  /**
   * Runs a PromQL instant query and returns a scalar ratio in [0, 1], or null when unusable.
   */
  async instantQueryScalar(query: string): Promise<number | null> {
    const url = buildInstantQueryUrl(this.config.baseUrl, query);
    const { status, json } = await jsonGet(url, {
      headers: { accept: 'application/json' },
      timeoutMs: this.config.timeoutMs,
      tlsInsecure: this.config.tlsInsecure,
    });

    if (status < 200 || status >= 300) {
      logger.debug('Prometheus instant query returned non-success HTTP status', {
        status,
        url,
      });
      return null;
    }

    return parseInstantScalar(json);
  }

  /**
   * Runs the v1 performance-metrics PromQL set. Returns only keys with usable scalar values.
   */
  async queryPerformanceScalars(): Promise<Partial<Record<PerformancePromqlKey, number>>> {
    const entries = await Promise.all(
      (Object.entries(PERFORMANCE_PROMQL) as [PerformancePromqlKey, string][]).map(
        async ([key, query]) => {
          try {
            const value = await this.instantQueryScalar(query);
            return [key, value] as const;
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.debug('Prometheus instant query failed', { key, error: msg });
            return [key, null] as const;
          }
        }
      )
    );

    const out: Partial<Record<PerformancePromqlKey, number>> = {};
    for (const [key, value] of entries) {
      if (value !== null) {
        out[key] = value;
      }
    }
    return out;
  }
}
