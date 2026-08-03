/**
 * Prometheus PromQL HTTP API response shapes (instant query).
 */

export interface PromInstantQueryResponse {
  status: string;
  data?: {
    resultType: string;
    result: PromInstantQueryVectorEntry[];
  };
  error?: string;
  errorType?: string;
}

export interface PromInstantQueryVectorEntry {
  metric: Record<string, string>;
  value: [number, string];
}

export interface PrometheusClientConfig {
  /** Normalized base URL without trailing slash (http/https). */
  baseUrl: string;
  timeoutMs: number;
  tlsInsecure: boolean;
}
