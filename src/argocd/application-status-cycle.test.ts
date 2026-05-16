import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArgoCDStatus } from '../status/types.js';

vi.mock('../cluster/identifier.js', () => ({
  generateClusterIdForCollection: () => 'cls_testclusterid0000000000000001',
}));

import {
  deriveArgoCdApiBaseUrl,
  runArgoCdApplicationStatusCycle,
} from './application-status-cycle.js';
import {
  clearLastArgoCdApplicationStatusBatch,
  getLastArgoCdApplicationStatusBatch,
} from './application-status-sink.js';
import type { ArgoCdApiCollectionEnvConfig } from './application-status-env.js';

describe('application-status-cycle', () => {
  beforeEach(() => {
    clearLastArgoCdApplicationStatusBatch();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLastArgoCdApplicationStatusBatch();
    delete process.env.ARGOCD_API_BEARER_TOKEN;
    delete process.env.ARGOCD_API_COLLECTION_ENABLED;
  });

  const baseEnv = (): ArgoCdApiCollectionEnvConfig => ({
    collectionEnabled: true,
    baseUrl: '',
    timeoutMs: 5000,
    tlsInsecure: false,
    serverServiceName: 'argocd-server',
  });

  const detected = (): ArgoCDStatus => ({
    detected: true,
    namespace: 'gitops',
    version: 'v2.14.0',
    lastChecked: new Date().toISOString(),
  });

  const notDetected = (): ArgoCDStatus => ({
    detected: false,
    namespace: null,
    version: null,
    lastChecked: new Date().toISOString(),
  });

  it('deriveArgoCdApiBaseUrl prefers explicit baseUrl', () => {
    const url = deriveArgoCdApiBaseUrl({ ...baseEnv(), baseUrl: 'https://cd.example/' }, notDetected());
    expect(url).toBe('https://cd.example');
  });

  it('deriveArgoCdApiBaseUrl uses service DNS when detected', () => {
    const url = deriveArgoCdApiBaseUrl({ ...baseEnv(), serverServiceName: 'custom-svc' }, detected());
    expect(url).toBe('https://custom-svc.gitops.svc.cluster.local');
  });

  it('deriveArgoCdApiBaseUrl returns null when undetectable', () => {
    const url = deriveArgoCdApiBaseUrl(baseEnv(), notDetected());
    expect(url).toBeNull();
  });

  it('runArgoCdApplicationStatusCycle skips when collection disabled', async () => {
    const outcome = await runArgoCdApplicationStatusCycle(() => detected(), {
      env: { ...baseEnv(), collectionEnabled: false },
    });
    expect(outcome).toBe('skipped');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('runArgoCdApplicationStatusCycle skips when no base URL', async () => {
    const outcome = await runArgoCdApplicationStatusCycle(() => notDetected(), {
      env: baseEnv(),
    });
    expect(outcome).toBe('skipped');
  });

  it('runArgoCdApplicationStatusCycle fails when token missing', async () => {
    const outcome = await runArgoCdApplicationStatusCycle(() => detected(), {
      env: { ...baseEnv(), baseUrl: 'https://argocd.local' },
      resolveToken: () => null,
    });
    expect(outcome).toBe('failed');
  });

  it('runArgoCdApplicationStatusCycle succeeds and publishes sink snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  metadata: { name: 'guestbook', namespace: 'argocd' },
                  status: {
                    sync: { status: 'Synced', revision: 'abc' },
                    health: { status: 'Healthy' },
                  },
                },
              ],
            }),
            { status: 200 }
          )
      )
    );

    const outcome = await runArgoCdApplicationStatusCycle(() => detected(), {
      env: { ...baseEnv(), baseUrl: 'https://cd.example/' },
      resolveToken: () => 'secret',
    });
    expect(outcome).toBe('success');

    const batch = getLastArgoCdApplicationStatusBatch();
    expect(batch?.applications).toHaveLength(1);
    expect(batch?.applications[0].name).toBe('guestbook');
    expect(batch?.apiBaseUrl).toBe('https://cd.example');
    expect(batch?.version).toBe('1.0');
  });

  it('uses ARGOCD_API_BEARER_TOKEN when set', async () => {
    process.env.ARGOCD_API_BEARER_TOKEN = 'from-env';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const auth =
          typeof init?.headers === 'object' && init.headers !== null && !Array.isArray(init.headers)
            ? new Headers(init.headers as HeadersInit).get('authorization')
            : null;
        expect(auth).toBe('Bearer from-env');
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      })
    );

    const outcome = await runArgoCdApplicationStatusCycle(() => detected(), {
      env: { ...baseEnv(), baseUrl: 'https://cd.example/' },
    });
    expect(outcome).toBe('success');
  });
});
