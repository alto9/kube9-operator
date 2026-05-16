import { describe, it, expect } from 'vitest';
import { normalizeApplicationSnapshot } from './application-snapshot-normalize.js';

describe('normalizeApplicationSnapshot', () => {
  it('maps representative Application API JSON', () => {
    const raw = {
      metadata: { namespace: 'argocd', name: 'guestbook' },
      status: {
        revision: 'deadbeef',
        sync: { status: 'OutOfSync' },
        health: { status: 'Healthy' },
      },
    };
    const s = normalizeApplicationSnapshot(raw);
    expect(s.namespace).toBe('argocd');
    expect(s.name).toBe('guestbook');
    expect(s.observedRevision).toBe('deadbeef');
    expect(s.syncStatus).toBe('OutOfSync');
    expect(s.healthStatus).toBe('Healthy');
  });

  it('handles non-object input safely', () => {
    const s = normalizeApplicationSnapshot(null);
    expect(s.syncStatus).toBe('Unknown');
    expect(s.healthStatus).toBe('Unknown');
    expect(s.namespace).toBe('');
  });

  it('counts OutOfSync entries in status.resources', () => {
    const raw = {
      metadata: { namespace: 'x', name: 'y' },
      status: {
        sync: { status: 'OutOfSync' },
        health: { status: 'Degraded' },
        resources: [{ status: 'OutOfSync' }, { status: 'Synced' }],
      },
    };
    const s = normalizeApplicationSnapshot(raw);
    expect(s.resourcesOutOfSyncCount).toBe(1);
  });

  it('accepts case-insensitive phases', () => {
    const raw = {
      metadata: { namespace: 'a', name: 'b' },
      status: {
        sync: { status: 'out of sync' },
        health: { status: 'UNKNOWN' },
      },
    };
    const s = normalizeApplicationSnapshot(raw);
    expect(s.syncStatus).toBe('OutOfSync');
    expect(s.healthStatus).toBe('Unknown');
  });
});
