import { describe, it, expect } from 'vitest';
import { classifyApplicationDrift } from './application-drift.js';
import type { ApplicationSnapshot } from './application-snapshot-types.js';

function snap(p: Partial<ApplicationSnapshot>): ApplicationSnapshot {
  return {
    namespace: 'argocd',
    name: 'guestbook',
    observedRevision: 'abc',
    syncStatus: 'Synced',
    healthStatus: 'Healthy',
    ...p,
  };
}

describe('classifyApplicationDrift', () => {
  it('Synced + Healthy → no drift', () => {
    const r = classifyApplicationDrift(snap({}));
    expect(r.driftDetected).toBe(false);
    expect(r.severity).toBe('none');
    expect(r.reasons).toContain('synced_healthy');
  });

  it('OutOfSync → drift with warning severity', () => {
    const r = classifyApplicationDrift(snap({ syncStatus: 'OutOfSync' }));
    expect(r.driftDetected).toBe(true);
    expect(r.severity).toBe('warning');
    expect(r.reasons).toContain('sync_out_of_sync');
  });

  it('OutOfSync + Missing health → critical', () => {
    const r = classifyApplicationDrift(
      snap({ syncStatus: 'OutOfSync', healthStatus: 'Missing' })
    );
    expect(r.driftDetected).toBe(true);
    expect(r.severity).toBe('critical');
    expect(r.reasons).toContain('health_missing');
  });

  it('Unknown sync → no drift flag, info severity', () => {
    const r = classifyApplicationDrift(snap({ syncStatus: 'Unknown' }));
    expect(r.driftDetected).toBe(false);
    expect(r.severity).toBe('info');
    expect(r.reasons).toContain('sync_status_unknown');
  });

  it('Synced + Degraded → no Git drift but warning for health', () => {
    const r = classifyApplicationDrift(snap({ healthStatus: 'Degraded' }));
    expect(r.driftDetected).toBe(false);
    expect(r.severity).toBe('warning');
    expect(r.reasons).toContain('synced_health_degraded');
  });

  it('Synced + Missing → warning', () => {
    const r = classifyApplicationDrift(snap({ healthStatus: 'Missing' }));
    expect(r.driftDetected).toBe(false);
    expect(r.severity).toBe('warning');
    expect(r.reasons).toContain('synced_health_missing');
  });

  it('includes resourcesOutOfSyncCount reason when set', () => {
    const r = classifyApplicationDrift(
      snap({ syncStatus: 'OutOfSync', resourcesOutOfSyncCount: 3 })
    );
    expect(r.reasons.some((x) => x.startsWith('resources_out_of_sync_count:'))).toBe(
      true
    );
  });

  it('missing identity → info', () => {
    const r = classifyApplicationDrift(
      snap({ namespace: '', name: '', observedRevision: null })
    );
    expect(r.severity).toBe('info');
    expect(r.reasons).toContain('incomplete_application_identity');
  });
});
