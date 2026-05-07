import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ArgoCdApplicationApiError,
  fetchArgoCdApplications,
  mapApplicationListToRecords,
} from './application-api-client.js';

describe('application-api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapApplicationListToRecords maps sync, health, revision', () => {
    const rows = mapApplicationListToRecords({
      items: [
        {
          metadata: { name: 'guestbook', namespace: 'argocd' },
          status: {
            sync: { status: 'Synced', revision: 'deadbeef' },
            health: { status: 'Healthy' },
          },
        },
      ],
    });
    expect(rows).toEqual([
      {
        name: 'guestbook',
        namespace: 'argocd',
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
        revision: 'deadbeef',
      },
    ]);
  });

  it('mapApplicationListToRecords defaults namespace when omitted', () => {
    const rows = mapApplicationListToRecords({
      items: [{ metadata: { name: 'solo' }, status: {} }],
    });
    expect(rows[0].namespace).toBe('default');
    expect(rows[0].syncStatus).toBeNull();
    expect(rows[0].healthStatus).toBeNull();
    expect(rows[0].revision).toBeNull();
  });

  it('mapApplicationListToRecords rejects invalid payloads', () => {
    expect(() => mapApplicationListToRecords({ items: 'nope' })).toThrow(ArgoCdApplicationApiError);
  });

  it('fetchArgoCdApplications parses 200 responses via fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  metadata: { name: 'app', namespace: 'argocd' },
                  status: {
                    sync: { status: 'OutOfSync' },
                    health: { status: 'Degraded' },
                  },
                },
              ],
            }),
            { status: 200 }
          )
      )
    );

    const rows = await fetchArgoCdApplications({
      baseUrl: 'https://argocd.example/',
      bearerToken: 'tok',
      timeoutMs: 5000,
      tlsInsecure: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('app');
    expect(rows[0].syncStatus).toBe('OutOfSync');
    expect(fetch).toHaveBeenCalledTimes(1);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/applications');
  });

  it('fetchArgoCdApplications throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('forbidden', { status: 403 })));

    await expect(
      fetchArgoCdApplications({
        baseUrl: 'https://argocd.example',
        bearerToken: 'x',
        timeoutMs: 1000,
        tlsInsecure: false,
      })
    ).rejects.toThrow(ArgoCdApplicationApiError);
  });
});
