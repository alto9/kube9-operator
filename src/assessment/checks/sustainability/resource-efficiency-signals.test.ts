import { describe, it, expect, vi } from 'vitest';
import {
  resourceEfficiencySignalsCheck,
  IDLE_ALLOCATABLE_UTILIZATION_WARN,
  MIN_ALLOCATABLE_CPU_CORES_FOR_IDLE_SIGNAL,
} from './resource-efficiency-signals.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  nodes: unknown[] = [],
  deployments: unknown[] = [],
  statefulSets: unknown[] = [],
  daemonSets: unknown[] = [],
): AssessmentRunContext {
  return {
    kubernetes: {
      coreApi: {
        listNode: vi.fn().mockResolvedValue({ items: nodes }),
      },
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: statefulSets }),
        listDaemonSetForAllNamespaces: vi.fn().mockResolvedValue({ items: daemonSets }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

const schedulableNode = (cpu: string, memory: string): unknown => ({
  metadata: { name: 'node-1' },
  spec: { unschedulable: false },
  status: { allocatable: { cpu, memory } },
});

describe('resourceEfficiencySignalsCheck', () => {
  it('uses sustainability pillar and stable check id', () => {
    expect(resourceEfficiencySignalsCheck.id).toBe('sustainability.resource-efficiency-signals');
    expect(resourceEfficiencySignalsCheck.pillar).toBe(Pillar.Sustainability);
  });

  it('skips when no allocatable CPU or memory on schedulable nodes', async () => {
    const ctx = createMockCtx(
      [{ metadata: { name: 'n' }, spec: { unschedulable: true }, status: { allocatable: {} } }],
      [],
    );
    const result = await resourceEfficiencySignalsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Skipped);
    expect(result.pillar).toBe(Pillar.Sustainability);
  });

  it('warns when CPU reservation is far below allocatable on a non-trivial cluster', async () => {
    const nodes = [schedulableNode('8', '32Gi')];
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'tiny' },
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: { requests: { cpu: '100m', memory: '256Mi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(nodes, deployments);
    const result = await resourceEfficiencySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('CPU requests');
    expect(MIN_ALLOCATABLE_CPU_CORES_FOR_IDLE_SIGNAL).toBeLessThanOrEqual(8);
    expect(IDLE_ALLOCATABLE_UTILIZATION_WARN).toBeGreaterThan(0.1);
  });

  it('passes when reservations use a healthy fraction of allocatable', async () => {
    const nodes = [schedulableNode('8', '16Gi')];
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: { requests: { cpu: '2', memory: '4Gi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(nodes, deployments);
    const result = await resourceEfficiencySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('50.0%');
  });

  it('excludes kube-system workloads from fleet sum', async () => {
    const nodes = [schedulableNode('4', '16Gi')];
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'infra' },
        spec: {
          replicas: 10,
          template: {
            spec: {
              containers: [
                { name: 'c', resources: { requests: { cpu: '1', memory: '1Gi' } } },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(nodes, deployments);
    const result = await resourceEfficiencySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
  });
});
