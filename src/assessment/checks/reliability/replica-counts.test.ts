import { describe, it, expect, vi } from 'vitest';
import { replicaCountsCheck } from './replica-counts.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  deployments: unknown[],
  statefulSets: unknown[] = []
): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: statefulSets }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('replicaCountsCheck', () => {
  it('passes when all HA workloads have >= 2 replicas', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: { replicas: 2 },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.checkId).toBe('reliability.replica-counts');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('at least 2');
  });

  it('fails when Deployment has replicas < 2', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'single-app' },
        spec: { replicas: 1 },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/single-app');
    expect(result.message).toContain('replicas=1');
    expect(result.remediation).toBeDefined();
  });

  it('skips workloads in kube-system', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'coredns' },
        spec: { replicas: 1 },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('skips workloads with ha-exempt label', async () => {
    const deployments = [
      {
        metadata: {
          namespace: 'default',
          name: 'intentional-single',
          labels: { 'kube9.io/ha-exempt': 'true' },
        },
        spec: { replicas: 1 },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no deployments exist', async () => {
    const ctx = createMockCtx([]);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when StatefulSet has replicas < 2', async () => {
    const statefulSets = [
      {
        metadata: { namespace: 'default', name: 'db' },
        spec: { replicas: 1 },
      },
    ];
    const ctx = createMockCtx([], statefulSets);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/db');
    expect(result.message).toContain('StatefulSet');
  });

  it('defaults replicas to 1 when unspecified', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-replicas' },
        spec: {},
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await replicaCountsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('replicas=1');
  });
});
