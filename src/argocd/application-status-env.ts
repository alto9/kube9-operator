import { existsSync, readFileSync } from 'node:fs';

function parseEnvBool(raw: string | undefined, defaultValue: boolean): boolean {
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
  throw new Error(
    `Invalid boolean for ARGOCD_API_COLLECTION_ENABLED / ARGOCD_API_TLS_INSECURE: "${raw}"`
  );
}

function parsePositiveInt(
  envName: string,
  raw: string | undefined,
  defaultValue: string,
  minInclusive: number = 1
): number {
  const s = raw !== undefined && raw !== '' ? raw : defaultValue;
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n < minInclusive) {
    throw new Error(`${envName} must be an integer >= ${minInclusive}`);
  }
  return n;
}

export interface ArgoCdApiCollectionEnvConfig {
  collectionEnabled: boolean;
  /** Explicit base URL for Argo CD API; empty when deriving from detection + service DNS. */
  baseUrl: string;
  timeoutMs: number;
  tlsInsecure: boolean;
  /** Service name segment for derived URL: https://{name}.{namespace}.svc.cluster.local */
  serverServiceName: string;
  /**
   * Path to bearer token. When unset, defaults to in-cluster SA token path if the file exists.
   */
  tokenFile?: string;
}

const DEFAULT_SA_TOKEN = '/var/run/secrets/kubernetes.io/serviceaccount/token';

/**
 * Read Argo CD API collection settings from environment (Helm wires the same names in deployment.yaml).
 */
export function parseArgoCdApiCollectionConfigFromEnv(): ArgoCdApiCollectionEnvConfig {
  return {
    collectionEnabled: parseEnvBool(process.env.ARGOCD_API_COLLECTION_ENABLED, true),
    baseUrl: (process.env.ARGOCD_API_BASE_URL ?? '').trim(),
    timeoutMs: parsePositiveInt(
      'ARGOCD_API_TIMEOUT_MS',
      process.env.ARGOCD_API_TIMEOUT_MS,
      '30000',
      1000
    ),
    tlsInsecure: parseEnvBool(process.env.ARGOCD_API_TLS_INSECURE, false),
    serverServiceName: (process.env.ARGOCD_API_SERVER_SERVICE_NAME ?? 'argocd-server').trim() || 'argocd-server',
    tokenFile: process.env.ARGOCD_API_TOKEN_FILE?.trim() || undefined,
  };
}

export function resolveArgoCdApiToken(config: ArgoCdApiCollectionEnvConfig): string | null {
  const fromEnv = process.env.ARGOCD_API_BEARER_TOKEN;
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }

  const path =
    config.tokenFile && config.tokenFile !== ''
      ? config.tokenFile
      : existsSync(DEFAULT_SA_TOKEN)
        ? DEFAULT_SA_TOKEN
        : null;

  if (!path) {
    return null;
  }

  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
}
