import { describe, it, expect, vi } from 'vitest';
import { backupDrSignalsCheck } from './backup-dr-signals.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  deployments: unknown[],
  crds: unknown[] = []
): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
      },
      apiextensionsApi: {
        listCustomResourceDefinition: vi.fn().mockResolvedValue({ body: { items: crds }, items: crds }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('backupDrSignalsCheck', () => {
  it('passes when Velero deployment is present', async () => {
    const deployments = [
      {
        metadata: { namespace: 'velero', name: 'velero', labels: { 'app.kubernetes.io/name': 'velero' } },
        spec: { template: { metadata: { labels: {} } } },
      },
    ];
    const ctx = createMockCtx(deployments, []);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.checkId).toBe('reliability.backup-dr-signals');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Velero');
  });

  it('passes when VolumeSnapshot CRD is present', async () => {
    const crds = [
      {
        metadata: { name: 'volumesnapshots.snapshot.storage.k8s.io' },
        spec: { group: 'snapshot.storage.k8s.io' },
      },
    ];
    const ctx = createMockCtx([], crds);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('VolumeSnapshot CRD');
  });

  it('passes when snapshot-controller deployment is present', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'snapshot-controller' },
        spec: { template: { metadata: { labels: {} } } },
      },
    ];
    const ctx = createMockCtx(deployments, []);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('snapshot-controller');
  });

  it('warns when no DR tooling detected', async () => {
    const ctx = createMockCtx([], []);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('No backup/DR tooling detected');
    expect(result.remediation).toBeDefined();
  });

  it('detects Velero via pod template labels', async () => {
    const deployments = [
      {
        metadata: { namespace: 'velero', name: 'velero' },
        spec: {
          template: { metadata: { labels: { 'app.kubernetes.io/name': 'velero' } } },
        },
      },
    ];
    const ctx = createMockCtx(deployments, []);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Velero');
  });

  it('ignores deployments without DR signals', async () => {
    const deployments = [
      { metadata: { namespace: 'default', name: 'nginx' }, spec: { template: { metadata: {} } } },
    ];
    const ctx = createMockCtx(deployments, []);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
  });

  it('aggregates multiple signals in passing message', async () => {
    const deployments = [
      {
        metadata: { name: 'velero', labels: { 'app.kubernetes.io/name': 'velero' } },
        spec: { template: { metadata: {} } },
      },
      {
        metadata: { name: 'snapshot-controller' },
        spec: { template: { metadata: {} } },
      },
    ];
    const crds = [
      {
        metadata: { name: 'volumesnapshots.snapshot.storage.k8s.io' },
        spec: { group: 'snapshot.storage.k8s.io' },
      },
    ];
    const ctx = createMockCtx(deployments, crds);
    const result = await backupDrSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Velero');
    expect(result.message).toContain('VolumeSnapshot CRD');
    expect(result.message).toContain('snapshot-controller');
  });
});
