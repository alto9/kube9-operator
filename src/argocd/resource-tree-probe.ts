/**
 * Lightweight resource-tree capability probe for status ConfigMap publishing.
 */

import { logger } from '../logging/logger.js';
import type { ArgoCDStatus, ArgoCDResourceTreeLastError } from '../status/types.js';
import {
  parseArgoCdApiCollectionConfigFromEnv,
  type ArgoCdApiCollectionEnvConfig,
} from './application-status-env.js';
import { probeArgoCdResourceTreeCapability } from './resource-tree-api-client.js';
import { resolveDedicatedArgoCdApiToken } from './resource-tree-auth.js';
import { deriveArgoCdApiBaseUrl } from './application-status-cycle.js';
import { ResourceTreeError } from './resource-tree-errors.js';

export interface ResourceTreeProbeResult {
  resourceTreeCapable?: boolean;
  resourceTreeLastError?: ArgoCDResourceTreeLastError;
}

export interface ResourceTreeProbeDeps {
  env: ArgoCdApiCollectionEnvConfig;
  probe: typeof probeArgoCdResourceTreeCapability;
}

/**
 * Run capability probe and return fields to merge into {@link ArgoCDStatus}.
 * Omits both fields when Argo CD is not detected.
 */
export async function runResourceTreeCapabilityProbe(
  detection: ArgoCDStatus,
  deps: Partial<ResourceTreeProbeDeps> = {}
): Promise<ResourceTreeProbeResult> {
  if (!detection.detected) {
    return {};
  }

  const env = deps.env ?? parseArgoCdApiCollectionConfigFromEnv();
  const token = resolveDedicatedArgoCdApiToken(env);

  if (!token) {
    return {
      resourceTreeCapable: false,
      resourceTreeLastError: {
        code: 'ARGOCD_TOKEN_MISSING',
        message: 'Dedicated Argo CD API bearer token is not configured',
      },
    };
  }

  const baseUrl = deriveArgoCdApiBaseUrl(env, detection);
  if (!baseUrl) {
    return {
      resourceTreeCapable: false,
      resourceTreeLastError: {
        code: 'ARGOCD_NOT_DETECTED',
        message: 'Argo CD API base URL is unavailable',
      },
    };
  }

  const probeFn = deps.probe ?? probeArgoCdResourceTreeCapability;

  try {
    await probeFn({
      baseUrl,
      bearerToken: token,
      timeoutMs: env.timeoutMs,
      tlsInsecure: env.tlsInsecure,
    });
    return { resourceTreeCapable: true };
  } catch (err) {
    if (err instanceof ResourceTreeError) {
      logger.debug('Argo CD resource-tree capability probe failed', {
        code: err.code,
        message: err.message,
      });
      return {
        resourceTreeCapable: false,
        resourceTreeLastError: { code: err.code, message: err.message },
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.debug('Argo CD resource-tree capability probe failed', { message });
    return {
      resourceTreeCapable: false,
      resourceTreeLastError: { code: 'INTERNAL_ERROR', message },
    };
  }
}

/**
 * Merge probe outcome into detection status for ConfigMap publish.
 */
export function mergeResourceTreeProbeIntoStatus(
  detection: ArgoCDStatus,
  probe: ResourceTreeProbeResult
): ArgoCDStatus {
  if (!detection.detected) {
    const { resourceTreeCapable: _c, resourceTreeLastError: _e, ...rest } = detection;
    return rest;
  }

  const merged: ArgoCDStatus = { ...detection };

  if (probe.resourceTreeCapable === true) {
    merged.resourceTreeCapable = true;
    delete merged.resourceTreeLastError;
    return merged;
  }

  if (probe.resourceTreeCapable === false) {
    merged.resourceTreeCapable = false;
    if (probe.resourceTreeLastError) {
      merged.resourceTreeLastError = probe.resourceTreeLastError;
    }
  }

  return merged;
}
