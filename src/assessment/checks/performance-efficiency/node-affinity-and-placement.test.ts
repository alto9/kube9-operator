import { describe, it, expect, vi } from 'vitest';
import { nodeAffinityAndPlacementCheck } from './node-affinity-and-placement.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(args?: {
  deployments?: unknown[];
  statefulSets?: unknown[];
  daemonSets?: unknown[];
  nodes?: unknown[];
}): AssessmentRunContext {
  const deployments = args?.deployments ?? [];
  const statefulSets = args?.statefulSets ?? [];
  const daemonSets = args?.daemonSets ?? [];
  const nodes = args?.nodes ?? [];

  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: statefulSets }),
        listDaemonSetForAllNamespaces: vi.fn().mockResolvedValue({ items: daemonSets }),
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

describe('nodeAffinityAndPlacementCheck', () => {
  it('warns when multi-replica workload has no anti-affinity or spread constraints', async () => {
    const result = await nodeAffinityAndPlacementCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'default', name: 'api' },
            spec: { replicas: 3, template: { spec: {} } },
          },
        ],
        nodes: [{ metadata: { name: 'node-a', labels: { 'kubernetes.io/hostname': 'node-a' } } }],
      }),
    );

    expect(result.checkId).toBe('performance-efficiency.node-affinity-and-placement');
    expect(result.pillar).toBe(Pillar.PerformanceEfficiency);
    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('default/api');
  });

  it('passes when workload has topology spread and broad node placement', async () => {
    const result = await nodeAffinityAndPlacementCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'default', name: 'api' },
            spec: {
              replicas: 3,
              template: {
                spec: {
                  topologySpreadConstraints: [
                    {
                      maxSkew: 1,
                      topologyKey: 'topology.kubernetes.io/zone',
                      whenUnsatisfiable: 'DoNotSchedule',
                    },
                  ],
                },
              },
            },
          },
        ],
        nodes: [
          { metadata: { name: 'node-a', labels: { 'topology.kubernetes.io/zone': 'a' } } },
          { metadata: { name: 'node-b', labels: { 'topology.kubernetes.io/zone': 'b' } } },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when nodeSelector cannot match any node', async () => {
    const result = await nodeAffinityAndPlacementCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'default', name: 'api' },
            spec: {
              replicas: 2,
              template: {
                spec: {
                  nodeSelector: { 'kubernetes.io/os': 'windows' },
                  topologySpreadConstraints: [
                    { maxSkew: 1, topologyKey: 'kubernetes.io/hostname', whenUnsatisfiable: 'DoNotSchedule' },
                  ],
                },
              },
            },
          },
        ],
        nodes: [{ metadata: { name: 'node-a', labels: { 'kubernetes.io/os': 'linux' } } }],
      }),
    );

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('match zero nodes');
  });

  it('warns when required node affinity limits placement to a single node', async () => {
    const result = await nodeAffinityAndPlacementCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'default', name: 'api' },
            spec: {
              replicas: 3,
              template: {
                spec: {
                  topologySpreadConstraints: [
                    { maxSkew: 1, topologyKey: 'kubernetes.io/hostname', whenUnsatisfiable: 'ScheduleAnyway' },
                  ],
                  affinity: {
                    nodeAffinity: {
                      requiredDuringSchedulingIgnoredDuringExecution: {
                        nodeSelectorTerms: [
                          {
                            matchExpressions: [
                              {
                                key: 'kubernetes.io/hostname',
                                operator: 'In',
                                values: ['node-a'],
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
        nodes: [
          { metadata: { name: 'node-a', labels: { 'kubernetes.io/hostname': 'node-a' } } },
          { metadata: { name: 'node-b', labels: { 'kubernetes.io/hostname': 'node-b' } } },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('matching only one node');
  });
});
