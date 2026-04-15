import { describe, it, expect, vi } from 'vitest';
import { spotInstanceUsageCheck } from './spot-instance-usage.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(args?: {
  deployments?: unknown[];
  statefulSets?: unknown[];
  nodes?: unknown[];
}): AssessmentRunContext {
  const deployments = args?.deployments ?? [];
  const statefulSets = args?.statefulSets ?? [];
  const nodes = args?.nodes ?? [];

  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: statefulSets }),
      },
      coreApi: {
        listNode: vi.fn().mockResolvedValue({ items: nodes }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('spotInstanceUsageCheck', () => {
  it('passes as not applicable when no spot capacity is detected', async () => {
    const result = await spotInstanceUsageCheck.run(
      createMockCtx({
        deployments: [{ metadata: { namespace: 'default', name: 'api' }, spec: { template: { spec: {} } } }],
        nodes: [{ metadata: { name: 'node-a', labels: { 'kubernetes.io/os': 'linux' } } }],
      }),
    );

    expect(result.checkId).toBe('cost-optimization.spot-instance-usage');
    expect(result.pillar).toBe(Pillar.CostOptimization);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('not applicable');
  });

  it('fails when spot capacity exists but no workload targets it', async () => {
    const result = await spotInstanceUsageCheck.run(
      createMockCtx({
        deployments: [
          { metadata: { namespace: 'default', name: 'api' }, spec: { template: { spec: {} } } },
          { metadata: { namespace: 'default', name: 'worker' }, spec: { template: { spec: {} } } },
        ],
        nodes: [
          { metadata: { name: 'spot-a', labels: { 'eks.amazonaws.com/capacityType': 'SPOT' } } },
          { metadata: { name: 'od-a', labels: { 'eks.amazonaws.com/capacityType': 'ON_DEMAND' } } },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('none of 2 in-scope workloads');
  });

  it('skips workloads labeled kube9.io/resource-exempt like other cost checks', async () => {
    const result = await spotInstanceUsageCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: {
              namespace: 'default',
              name: 'exempt',
              labels: { 'kube9.io/resource-exempt': 'true' },
            },
            spec: { template: { spec: {} } },
          },
          { metadata: { namespace: 'default', name: 'api' }, spec: { template: { spec: {} } } },
        ],
        nodes: [{ metadata: { name: 'spot-a', labels: { 'eks.amazonaws.com/capacityType': 'SPOT' } } }],
      }),
    );

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('none of 1 in-scope workloads');
  });

  it('warns when only some workloads are spot-aware', async () => {
    const result = await spotInstanceUsageCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'default', name: 'api' },
            spec: {
              template: {
                spec: {
                  nodeSelector: { 'karpenter.sh/capacity-type': 'spot' },
                },
              },
            },
          },
          { metadata: { namespace: 'default', name: 'worker' }, spec: { template: { spec: {} } } },
        ],
        nodes: [{ metadata: { name: 'spot-a', labels: { 'karpenter.sh/capacity-type': 'spot' } } }],
      }),
    );

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('1/2');
  });

  it('passes when all in-scope workloads target spot/preemptible capacity', async () => {
    const result = await spotInstanceUsageCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'default', name: 'api' },
            spec: {
              template: {
                spec: {
                  affinity: {
                    nodeAffinity: {
                      requiredDuringSchedulingIgnoredDuringExecution: {
                        nodeSelectorTerms: [
                          {
                            matchExpressions: [
                              {
                                key: 'eks.amazonaws.com/capacityType',
                                operator: 'In',
                                values: ['SPOT'],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        statefulSets: [
          {
            metadata: { namespace: 'default', name: 'db' },
            spec: {
              template: {
                spec: {
                  tolerations: [{ key: 'spot', operator: 'Exists', effect: 'NoSchedule' }],
                },
              },
            },
          },
        ],
        nodes: [{ metadata: { name: 'spot-a', labels: { 'eks.amazonaws.com/capacityType': 'SPOT' } } }],
      }),
    );

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('all 2 in-scope workloads');
  });
});
