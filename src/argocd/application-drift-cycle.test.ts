import { describe, it, expect } from 'vitest';
import {
  ApplicationDriftCycleState,
  runApplicationDriftCycle,
} from './application-drift-cycle.js';
import type { ApplicationSnapshot } from './application-snapshot-types.js';

describe('ApplicationDriftCycleState', () => {
  it('updates stored snapshot per application key across batches', () => {
    const state = new ApplicationDriftCycleState();
    const s1: ApplicationSnapshot = {
      namespace: 'argocd',
      name: 'guestbook',
      observedRevision: '1',
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
    };
    const s2: ApplicationSnapshot = { ...s1, syncStatus: 'OutOfSync' };

    state.processBatch([s1]);
    expect(state.getPreviousSnapshotForTest('argocd/guestbook')?.syncStatus).toBe('Synced');

    state.processBatch([s2]);
    expect(state.getPreviousSnapshotForTest('argocd/guestbook')?.syncStatus).toBe('OutOfSync');
  });

  it('prunes applications absent from the latest batch', () => {
    const state = new ApplicationDriftCycleState();
    const s1: ApplicationSnapshot = {
      namespace: 'argocd',
      name: 'a',
      observedRevision: null,
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
    };
    state.processBatch([s1]);
    expect(state.getPreviousSnapshotForTest('argocd/a')).toBeDefined();
    state.processBatch([]);
    expect(state.getPreviousSnapshotForTest('argocd/a')).toBeUndefined();
  });

  it('runApplicationDriftCycle delegates to collect and updates state', async () => {
    const state = new ApplicationDriftCycleState();
    const snap: ApplicationSnapshot = {
      namespace: 'argocd',
      name: 'x',
      observedRevision: null,
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
    };
    await runApplicationDriftCycle(async () => [snap], state);
    expect(state.getPreviousSnapshotForTest('argocd/x')).toEqual(snap);
  });
});
