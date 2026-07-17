import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchArgoCdResourceTree,
  probeArgoCdResourceTreeCapability,
} from './resource-tree-api-client.js';
import { ResourceTreeError } from './resource-tree-errors.js';

describe('resource-tree-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"nodes":[]}', { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchArgoCdResourceTree returns raw body on success', async () => {
    const raw = '{"nodes":[{"kind":"Pod"}]}';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(raw, { status: 200 })));

    const body = await fetchArgoCdResourceTree({
      baseUrl: 'https://argocd.local',
      appName: 'guestbook',
      appNamespace: 'argocd',
      bearerToken: 'tok',
      timeoutMs: 5000,
      tlsInsecure: false,
    });

    expect(body).toBe(raw);
    expect(fetch).toHaveBeenCalledWith(
      'https://argocd.local/api/v1/applications/guestbook/resource-tree?appNamespace=argocd',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
  });

  it('fetchArgoCdResourceTree maps 404 to APPLICATION_NOT_FOUND', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));

    await expect(
      fetchArgoCdResourceTree({
        baseUrl: 'https://argocd.local',
        appName: 'missing',
        appNamespace: 'argocd',
        bearerToken: 'tok',
        timeoutMs: 5000,
        tlsInsecure: false,
      })
    ).rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
  });

  it('probeArgoCdResourceTreeCapability succeeds on 200 list', async () => {
    await expect(
      probeArgoCdResourceTreeCapability({
        baseUrl: 'https://argocd.local',
        bearerToken: 'tok',
        timeoutMs: 5000,
        tlsInsecure: false,
      })
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      'https://argocd.local/api/v1/applications',
      expect.any(Object)
    );
  });

  it('probeArgoCdResourceTreeCapability maps 403 to RBAC denied', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 403 })));

    await expect(
      probeArgoCdResourceTreeCapability({
        baseUrl: 'https://argocd.local',
        bearerToken: 'tok',
        timeoutMs: 5000,
        tlsInsecure: false,
      })
    ).rejects.toBeInstanceOf(ResourceTreeError);
  });
});
