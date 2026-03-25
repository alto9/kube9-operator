import { describe, it, expect, vi } from 'vitest';
import { podDisruptionBudgetsCheck } from './pod-disruption-budgets.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  deployments: unknown[],
  statefulSets: unknown[] = [],
  pdbs: unknown[] = []
): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: statefulSets }),
      },
      policyApi: {
        listPodDisruptionBudgetForAllNamespaces: vi.fn().mockResolvedValue({ items: pdbs }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('podDisruptionBudgetsCheck', () => {
  it('passes when multi-replica workloads have PDB coverage', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: { metadata: { labels: { app: 'app' } } },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'default' },
        spec: {
          selector: { matchLabels: { app: 'app' } },
          minAvailable: 1,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.checkId).toBe('reliability.pod-disruption-budgets');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('warns when multi-replica workload lacks PDB', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: { metadata: { labels: { app: 'app' } } },
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], []);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('default/app');
    expect(result.remediation).toBeDefined();
  });

  it('passes when single-replica workload has no PDB (not applicable)', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'cron' },
        spec: {
          replicas: 1,
          template: { metadata: {} },
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], []);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no workloads exist', async () => {
    const ctx = createMockCtx([], [], []);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('matches PDB by selector overlap with pod template labels', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'api' },
        spec: {
          replicas: 3,
          template: { metadata: { labels: { app: 'api', tier: 'backend' } } },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'default' },
        spec: {
          selector: { matchLabels: { app: 'api' } },
          minAvailable: 2,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('does not match PDB when labels differ', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'api' },
        spec: {
          replicas: 2,
          template: { metadata: { labels: { app: 'api' } } },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'default' },
        spec: {
          selector: { matchLabels: { app: 'other' } },
          minAvailable: 1,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('default/api');
  });

  it('does not match PDB in different namespace', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'api' },
        spec: {
          replicas: 2,
          template: { metadata: { labels: { app: 'api' } } },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'prod' },
        spec: {
          selector: { matchLabels: { app: 'api' } },
          minAvailable: 1,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
  });

  it('matches selector using only matchExpressions', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'api' },
        spec: {
          replicas: 2,
          template: {
            metadata: { labels: { app: 'api', tier: 'backend', env: 'prod' } },
          },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'default' },
        spec: {
          selector: {
            matchExpressions: [
              { key: 'tier', operator: 'In', values: ['backend', 'worker'] },
              { key: 'app', operator: 'Exists' },
              { key: 'track', operator: 'DoesNotExist' },
              { key: 'env', operator: 'NotIn', values: ['staging'] },
            ],
          },
          minAvailable: 1,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('matches selector using matchLabels and matchExpressions together', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'api' },
        spec: {
          replicas: 2,
          template: {
            metadata: { labels: { app: 'api', tier: 'backend', env: 'prod' } },
          },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'default' },
        spec: {
          selector: {
            matchLabels: { app: 'api' },
            matchExpressions: [{ key: 'tier', operator: 'In', values: ['backend'] }],
          },
          minAvailable: 1,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('does not match selector when a matchExpression mismatches', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'api' },
        spec: {
          replicas: 2,
          template: {
            metadata: { labels: { app: 'api', tier: 'backend', env: 'prod' } },
          },
        },
      },
    ];
    const pdbs = [
      {
        metadata: { namespace: 'default' },
        spec: {
          selector: {
            matchLabels: { app: 'api' },
            matchExpressions: [{ key: 'env', operator: 'NotIn', values: ['prod', 'staging'] }],
          },
          minAvailable: 1,
        },
      },
    ];
    const ctx = createMockCtx(deployments, [], pdbs);
    const result = await podDisruptionBudgetsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('default/api');
  });
});
