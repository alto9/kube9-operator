import { afterEach, describe, expect, it } from 'vitest';
import { resolveResourceTreeRequestContext } from './resource-tree-context.js';
import { ResourceTreeError } from './resource-tree-errors.js';
import type { ArgoCDStatus } from '../status/types.js';
import type { ArgoCdApiCollectionEnvConfig } from './application-status-env.js';

describe('resource-tree-context', () => {
  afterEach(() => {
    delete process.env.ARGOCD_API_BEARER_TOKEN;
    delete process.env.ARGOCD_API_BASE_URL;
  });

  const detected = (): ArgoCDStatus => ({
    detected: true,
    namespace: 'gitops',
    version: 'v2.14.0',
    lastChecked: new Date().toISOString(),
  });

  const env = (): ArgoCdApiCollectionEnvConfig => ({
    collectionEnabled: true,
    baseUrl: '',
    timeoutMs: 30000,
    tlsInsecure: false,
    serverServiceName: 'argocd-server',
  });

  it('derives base URL from detection when ARGOCD_API_BASE_URL unset', () => {
    process.env.ARGOCD_API_BEARER_TOKEN = 'tok';
    const ctx = resolveResourceTreeRequestContext(detected(), env());
    expect(ctx.baseUrl).toBe('https://argocd-server.gitops.svc.cluster.local');
    expect(ctx.bearerToken).toBe('tok');
  });

  it('throws ARGOCD_NOT_DETECTED when base URL unavailable', () => {
    process.env.ARGOCD_API_BEARER_TOKEN = 'tok';
    expect(() =>
      resolveResourceTreeRequestContext(
        { detected: false, namespace: null, version: null, lastChecked: 't' },
        env()
      )
    ).toThrowError(ResourceTreeError);
  });

  it('throws ARGOCD_TOKEN_MISSING when bearer unset', () => {
    expect(() => resolveResourceTreeRequestContext(detected(), env())).toThrowError(
      expect.objectContaining({ code: 'ARGOCD_TOKEN_MISSING' })
    );
  });
});
