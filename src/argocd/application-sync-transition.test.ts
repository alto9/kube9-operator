import { describe, it, expect } from 'vitest';
import { detectSyncStatusTransition } from './application-sync-transition.js';
import type { ApplicationSnapshot } from './application-snapshot-types.js';

function snap(p: Partial<ApplicationSnapshot>): ApplicationSnapshot {
  return {
    namespace: 'argocd',
    name: 'guestbook',
    observedRevision: null,
    syncStatus: 'Synced',
    healthStatus: 'Healthy',
    ...p,
  };
}

describe('detectSyncStatusTransition', () => {
  it('returns null without previous snapshot', () => {
    expect(detectSyncStatusTransition(undefined, snap({}))).toBeNull();
  });

  it('detects Synced → OutOfSync', () => {
    const prev = snap({ syncStatus: 'Synced' });
    const cur = snap({ syncStatus: 'OutOfSync' });
    const t = detectSyncStatusTransition(prev, cur);
    expect(t?.kind).toBe('became_out_of_sync');
    expect(t?.previousSync).toBe('Synced');
    expect(t?.currentSync).toBe('OutOfSync');
  });

  it('detects OutOfSync → Synced', () => {
    const prev = snap({ syncStatus: 'OutOfSync' });
    const cur = snap({ syncStatus: 'Synced' });
    const t = detectSyncStatusTransition(prev, cur);
    expect(t?.kind).toBe('became_synced');
  });

  it('returns none kind when unchanged', () => {
    const prev = snap({ syncStatus: 'Synced' });
    const cur = snap({ syncStatus: 'Synced' });
    const t = detectSyncStatusTransition(prev, cur);
    expect(t?.kind).toBe('none');
  });

  it('returns null when identity differs', () => {
    const prev = snap({ name: 'a' });
    const cur = snap({ name: 'b' });
    expect(detectSyncStatusTransition(prev, cur)).toBeNull();
  });

  it('Unknown transitions use generic sync_status_changed', () => {
    const prev = snap({ syncStatus: 'Unknown' });
    const cur = snap({ syncStatus: 'OutOfSync' });
    const t = detectSyncStatusTransition(prev, cur);
    expect(t?.kind).toBe('sync_status_changed');
  });
});
