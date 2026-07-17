import { existsSync, readFileSync } from 'node:fs';
import type { ArgoCdApiCollectionEnvConfig } from './application-status-env.js';

/**
 * Resolve dedicated Argo CD API bearer for resource-tree (M17).
 * No Kubernetes ServiceAccount token fallback on this path.
 */
export function resolveDedicatedArgoCdApiToken(config: ArgoCdApiCollectionEnvConfig): string | null {
  const fromEnv = process.env.ARGOCD_API_BEARER_TOKEN;
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }

  const path = config.tokenFile?.trim();
  if (!path) {
    return null;
  }

  if (!existsSync(path)) {
    return null;
  }

  try {
    const token = readFileSync(path, 'utf8').trim();
    return token === '' ? null : token;
  } catch {
    return null;
  }
}
