import { describe, it, expect, vi } from 'vitest';
import { hpaConfigurationSanityCheck } from './hpa-configuration-sanity.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  hpas: unknown[] = [],
  deployments: unknown[] = [],
  statefulSets: unknown[] = [],
): AssessmentRunContext {
  return {
    kubernetes: {
      autoscalingApi: {
        listHorizontalPodAutoscalerForAllNamespaces: vi.fn().mockResolvedValue({ items: hpas }),
      },
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

describe('hpaConfigurationSanityCheck', () => {
  it('passes when HPAs are valid and cover in-scope workloads', async () => {
    const deployments = [{ metadata: { namespace: 'default', name: 'api' } }];
    const hpas = [
      {
        metadata: { namespace: 'default', name: 'api-hpa' },
        spec: {
          scaleTargetRef: { kind: 'Deployment', name: 'api' },
          minReplicas: 2,
          maxReplicas: 10,
          metrics: [{ type: 'Resource' }],
          behavior: { scaleUp: { policies: [{ type: 'Pods', value: 2, periodSeconds: 60 }] } },
        },
      },
    ];
    const result = await hpaConfigurationSanityCheck.run(createMockCtx(hpas, deployments));

    expect(result.checkId).toBe('performance-efficiency.hpa-configuration-sanity');
    expect(result.pillar).toBe(Pillar.PerformanceEfficiency);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('warns when in-scope workloads exist but no HPA objects are present', async () => {
    const deployments = [{ metadata: { namespace: 'default', name: 'api' } }];
    const result = await hpaConfigurationSanityCheck.run(createMockCtx([], deployments));

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('No HPAs detected');
  });

  it('fails when minReplicas exceeds maxReplicas', async () => {
    const deployments = [{ metadata: { namespace: 'default', name: 'api' } }];
    const hpas = [
      {
        metadata: { namespace: 'default', name: 'bad-hpa' },
        spec: {
          scaleTargetRef: { kind: 'Deployment', name: 'api' },
          minReplicas: 5,
          maxReplicas: 2,
          metrics: [{ type: 'Resource' }],
        },
      },
    ];
    const result = await hpaConfigurationSanityCheck.run(createMockCtx(hpas, deployments));

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('minReplicas');
  });

  it('fails when target workload does not exist', async () => {
    const hpas = [
      {
        metadata: { namespace: 'default', name: 'dangling-hpa' },
        spec: {
          scaleTargetRef: { kind: 'Deployment', name: 'missing' },
          minReplicas: 1,
          maxReplicas: 4,
          metrics: [{ type: 'Resource' }],
        },
      },
    ];
    const result = await hpaConfigurationSanityCheck.run(createMockCtx(hpas));

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('not found');
  });

  it('fails when metrics are omitted', async () => {
    const deployments = [{ metadata: { namespace: 'default', name: 'api' } }];
    const hpas = [
      {
        metadata: { namespace: 'default', name: 'no-metrics' },
        spec: {
          scaleTargetRef: { kind: 'Deployment', name: 'api' },
          minReplicas: 1,
          maxReplicas: 4,
          metrics: [],
        },
      },
    ];
    const result = await hpaConfigurationSanityCheck.run(createMockCtx(hpas, deployments));

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('metrics not configured');
  });

  it('warns when HPA coverage is below threshold', async () => {
    const deployments = [
      { metadata: { namespace: 'default', name: 'api' } },
      { metadata: { namespace: 'default', name: 'worker' } },
      { metadata: { namespace: 'default', name: 'cron' } },
    ];
    const hpas = [
      {
        metadata: { namespace: 'default', name: 'api-hpa' },
        spec: {
          scaleTargetRef: { kind: 'Deployment', name: 'api' },
          minReplicas: 1,
          maxReplicas: 3,
          metrics: [{ type: 'Resource' }],
        },
      },
    ];
    const result = await hpaConfigurationSanityCheck.run(createMockCtx(hpas, deployments));

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('coverage is low');
  });
});
