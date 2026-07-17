import { describe, expect, it, vi } from 'vitest';
import type { ArgoCDStatus } from '../status/types.js';
import {
  mergeResourceTreeProbeIntoStatus,
  runResourceTreeCapabilityProbe,
} from './resource-tree-probe.js';
import type { ArgoCdApiCollectionEnvConfig } from './application-status-env.js';

describe('resource-tree-probe', () => {
  const detected = (): ArgoCDStatus => ({
    detected: true,
    namespace: 'argocd',
    version: 'v2.14.0',
    lastChecked: new Date().toISOString(),
  });

  const baseEnv = (): ArgoCdApiCollectionEnvConfig => ({
    collectionEnabled: true,
    baseUrl: 'https://argocd.local',
    timeoutMs: 5000,
    tlsInsecure: false,
    serverServiceName: 'argocd-server',
  });

  it('omits capability fields when Argo CD is not detected', async () => {
    const result = await runResourceTreeCapabilityProbe({
      detected: false,
      namespace: null,
      version: null,
      lastChecked: new Date().toISOString(),
    });
    expect(result).toEqual({});
  });

  it('demotes when dedicated token is missing', async () => {
    const result = await runResourceTreeCapabilityProbe(detected(), {
      env: baseEnv(),
    });
    expect(result).toEqual({
      resourceTreeCapable: false,
      resourceTreeLastError: {
        code: 'ARGOCD_TOKEN_MISSING',
        message: 'Dedicated Argo CD API bearer token is not configured',
      },
    });
  });

  it('sets capable true after successful probe with token env', async () => {
    process.env.ARGOCD_API_BEARER_TOKEN = 'probe-token';
    try {
      const result = await runResourceTreeCapabilityProbe(detected(), {
        env: baseEnv(),
        probe: vi.fn(async () => undefined),
      });
      expect(result).toEqual({ resourceTreeCapable: true });
    } finally {
      delete process.env.ARGOCD_API_BEARER_TOKEN;
    }
  });

  it('demotes on cluster-wide probe auth failure', async () => {
    process.env.ARGOCD_API_BEARER_TOKEN = 'bad';
    try {
      const result = await runResourceTreeCapabilityProbe(detected(), {
        env: baseEnv(),
        probe: vi.fn(async () => {
          const { ResourceTreeError } = await import('./resource-tree-errors.js');
          throw new ResourceTreeError('ARGOCD_AUTH_FAILED', 'auth failed');
        }),
      });
      expect(result.resourceTreeCapable).toBe(false);
      expect(result.resourceTreeLastError?.code).toBe('ARGOCD_AUTH_FAILED');
    } finally {
      delete process.env.ARGOCD_API_BEARER_TOKEN;
    }
  });

  it('mergeResourceTreeProbeIntoStatus omits fields when not detected', () => {
    const merged = mergeResourceTreeProbeIntoStatus(
      {
        detected: false,
        namespace: null,
        version: null,
        lastChecked: 't',
        resourceTreeCapable: false,
      },
      { resourceTreeCapable: false }
    );
    expect(merged.resourceTreeCapable).toBeUndefined();
    expect(merged.resourceTreeLastError).toBeUndefined();
  });

  it('mergeResourceTreeProbeIntoStatus clears lastError when capable', () => {
    const merged = mergeResourceTreeProbeIntoStatus(
      {
        ...detected(),
        resourceTreeCapable: false,
        resourceTreeLastError: { code: 'ARGOCD_TOKEN_MISSING', message: 'x' },
      },
      { resourceTreeCapable: true }
    );
    expect(merged.resourceTreeCapable).toBe(true);
    expect(merged.resourceTreeLastError).toBeUndefined();
  });
});
