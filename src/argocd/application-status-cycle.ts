/**
 * Scheduled Argo CD Application status collection (#55).
 */

import { randomBytes } from 'node:crypto';
import { logger } from '../logging/logger.js';
import type { ArgoCDStatus } from '../status/types.js';
import { generateClusterIdForCollection } from '../cluster/identifier.js';
import type { ArgoCdApplicationStatusBatch } from './application-status-types.js';
import {
  parseArgoCdApiCollectionConfigFromEnv,
  resolveArgoCdApiToken,
  type ArgoCdApiCollectionEnvConfig,
} from './application-status-env.js';
import type { ArgoCdApplicationStatusRecord } from './application-status-types.js';
import {
  ArgoCdApplicationApiError,
  fetchArgoCdApplications,
} from './application-api-client.js';
import { setLastArgoCdApplicationStatusBatch } from './application-status-sink.js';

export type ArgoCdApplicationStatusCycleOutcome = 'success' | 'failed' | 'skipped';

export interface ArgoCdApplicationStatusCycleDeps {
  env: ArgoCdApiCollectionEnvConfig;
  fetchApplications: typeof fetchArgoCdApplications;
  resolveToken: typeof resolveArgoCdApiToken;
}

function generateCollectionId(): string {
  const random = randomBytes(16).toString('hex');
  return `acos_${random}`;
}

/**
 * Derive https://argocd-server.{namespace}.svc.cluster.local when detection reports a namespace.
 */
export function deriveArgoCdApiBaseUrl(env: ArgoCdApiCollectionEnvConfig, status: ArgoCDStatus): string | null {
  if (env.baseUrl) {
    return env.baseUrl.replace(/\/+$/, '');
  }
  if (status.detected && status.namespace) {
    const svc = env.serverServiceName;
    return `https://${svc}.${status.namespace}.svc.cluster.local`;
  }
  return null;
}

export async function runArgoCdApplicationStatusCycle(
  getArgoCdStatus: () => ArgoCDStatus,
  deps: Partial<ArgoCdApplicationStatusCycleDeps> = {}
): Promise<ArgoCdApplicationStatusCycleOutcome> {
  const envConfig = deps.env ?? parseArgoCdApiCollectionConfigFromEnv();
  if (!envConfig.collectionEnabled) {
    logger.debug('Argo CD application API collection disabled');
    return 'skipped';
  }

  const status = getArgoCdStatus();
  const baseUrl = deriveArgoCdApiBaseUrl(envConfig, status);

  if (!baseUrl) {
    logger.info(
      'Skipping Argo CD application status collection (set ARGOCD_API_BASE_URL or ensure Argo CD is detected)'
    );
    return 'skipped';
  }

  const fetchFn = deps.fetchApplications ?? fetchArgoCdApplications;
  const token = (deps.resolveToken ?? resolveArgoCdApiToken)(envConfig);

  if (!token) {
    logger.warn(
      'Argo CD application status collection failed: no bearer token (set ARGOCD_API_BEARER_TOKEN, ARGOCD_API_TOKEN_FILE, or mount a service account token)'
    );
    return 'failed';
  }

  try {
    const apps: ArgoCdApplicationStatusRecord[] = await fetchFn({
      baseUrl,
      bearerToken: token,
      timeoutMs: envConfig.timeoutMs,
      tlsInsecure: envConfig.tlsInsecure,
    });

    const collectedAt = new Date().toISOString();
    const batch: ArgoCdApplicationStatusBatch = {
      version: '1.0',
      collectedAt,
      collectionId: generateCollectionId(),
      clusterId: generateClusterIdForCollection(),
      argocdNamespace: status.detected ? status.namespace : null,
      apiBaseUrl: baseUrl,
      applications: apps,
    };

    setLastArgoCdApplicationStatusBatch(batch);

    logger.info('Argo CD application status collection succeeded', {
      applicationCount: apps.length,
      apiBaseUrl: baseUrl,
    });

    return 'success';
  } catch (err) {
    if (err instanceof ArgoCdApplicationApiError) {
      logger.warn('Argo CD application status collection failed', {
        code: err.code,
        message: err.message,
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Argo CD application status collection failed', { message });
    }
    return 'failed';
  }
}
