import { describe, it, expect, vi } from 'vitest';
import { spreadAntiAffinityCheck } from './spread-anti-affinity.js';
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

describe('spreadAntiAffinityCheck', () => {
  it('passes when multi-replica workloads have anti-affinity', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: {
            spec: {
              affinity: {
                podAntiAffinity: {
                  requiredDuringSchedulingIgnoredDuringExecution: [
                    { labelSelector: { matchLabels: { app: 'app' } }, topologyKey: 'kubernetes.io/hostname' },
                  ],
                },
              },
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await spreadAntiAffinityCheck.run(ctx);

    expect(result.checkId).toBe('reliability.spread-anti-affinity');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when multi-replica workloads have topology spread', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: {
            spec: {
              topologySpreadConstraints: [
                { maxSkew: 1, topologyKey: 'kubernetes.io/hostname', whenUnsatisfiable: 'ScheduleAnyway' },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await spreadAntiAffinityCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('warns when multi-replica workload lacks spread/anti-affinity', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: { spec: {} },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await spreadAntiAffinityCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('default/app');
    expect(result.remediation).toBeDefined();
  });

  it('passes when single-replica workload has no spread (not applicable)', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'cron' },
        spec: {
          replicas: 1,
          template: { spec: {} },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await spreadAntiAffinityCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no workloads exist', async () => {
    const ctx = createMockCtx([]);
    const result = await spreadAntiAffinityCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('accepts preferredDuringScheduling anti-affinity', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 2,
          template: {
            spec: {
              affinity: {
                podAntiAffinity: {
                  preferredDuringSchedulingIgnoredDuringExecution: [
                    { podAffinityTerm: { labelSelector: { matchLabels: { app: 'app' } }, topologyKey: 'hostname' }, weight: 100 },
                  ],
                },
              },
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await spreadAntiAffinityCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });
});
