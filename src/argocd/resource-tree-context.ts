import type { ArgoCDStatus } from '../status/types.js';
import {
  parseArgoCdApiCollectionConfigFromEnv,
  type ArgoCdApiCollectionEnvConfig,
} from './application-status-env.js';
import { deriveArgoCdApiBaseUrl } from './application-status-cycle.js';
import { resolveDedicatedArgoCdApiToken } from './resource-tree-auth.js';
import { ResourceTreeError } from './resource-tree-errors.js';

export interface ResourceTreeRequestContext {
  env: ArgoCdApiCollectionEnvConfig;
  baseUrl: string;
  bearerToken: string;
}

/**
 * Resolve base URL and dedicated bearer for resource-tree CLI or probe.
 */
export function resolveResourceTreeRequestContext(
  argocdStatus: ArgoCDStatus,
  env: ArgoCdApiCollectionEnvConfig = parseArgoCdApiCollectionConfigFromEnv()
): ResourceTreeRequestContext {
  const baseUrl = deriveArgoCdApiBaseUrl(env, argocdStatus);
  if (!baseUrl) {
    throw new ResourceTreeError(
      'ARGOCD_NOT_DETECTED',
      'Argo CD is not detected and ARGOCD_API_BASE_URL is not set'
    );
  }

  const bearerToken = resolveDedicatedArgoCdApiToken(env);
  if (!bearerToken) {
    throw new ResourceTreeError(
      'ARGOCD_TOKEN_MISSING',
      'Dedicated Argo CD API bearer token is not configured (set ARGOCD_API_BEARER_TOKEN or ARGOCD_API_TOKEN_FILE)'
    );
  }

  return { env, baseUrl, bearerToken };
}
