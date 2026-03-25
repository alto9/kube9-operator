import { describe, it, expect, vi } from 'vitest';
import { vpaConfigurationSanityCheck } from './vpa-configuration-sanity.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(args?: {
  vpaCrdMissing?: boolean;
  vpas?: unknown[];
  deployments?: unknown[];
  statefulSets?: unknown[];
}): AssessmentRunContext {
  const vpaCrdMissing = args?.vpaCrdMissing ?? false;
  const vpas = args?.vpas ?? [];
  const deployments = args?.deployments ?? [];
  const statefulSets = args?.statefulSets ?? [];

  const readCustomResourceDefinition = vpaCrdMissing
    ? vi.fn().mockRejectedValue({ response: { statusCode: 404 } })
    : vi.fn().mockResolvedValue({ metadata: { name: 'verticalpodautoscalers.autoscaling.k8s.io' } });

  return {
    kubernetes: {
      apiextensionsApi: {
        readCustomResourceDefinition,
      },
      customObjectsApi: {
        listClusterCustomObject: vi.fn().mockResolvedValue({ body: { items: vpas }, items: vpas }),
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

describe('vpaConfigurationSanityCheck', () => {
  it('warns with clear message when VPA CRD is missing', async () => {
    const result = await vpaConfigurationSanityCheck.run(createMockCtx({ vpaCrdMissing: true }));

    expect(result.checkId).toBe('performance-efficiency.vpa-configuration-sanity');
    expect(result.pillar).toBe(Pillar.PerformanceEfficiency);
    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('VPA CRD not detected');
  });

  it('warns when CRD exists but no VPA objects are found', async () => {
    const result = await vpaConfigurationSanityCheck.run(createMockCtx());

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('no VPA objects');
  });

  it('fails when VPA targetRef does not point to an existing workload', async () => {
    const vpas = [
      {
        metadata: { namespace: 'default', name: 'api-vpa' },
        spec: {
          targetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'missing' },
          updatePolicy: { updateMode: 'Auto' },
        },
      },
    ];
    const result = await vpaConfigurationSanityCheck.run(createMockCtx({ vpas }));

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('not found');
  });

  it('warns when all VPA objects are recommendation-only', async () => {
    const deployments = [{ metadata: { namespace: 'default', name: 'api' } }];
    const vpas = [
      {
        metadata: { namespace: 'default', name: 'api-vpa' },
        spec: {
          targetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'api' },
          updatePolicy: { updateMode: 'Off' },
        },
      },
    ];
    const result = await vpaConfigurationSanityCheck.run(createMockCtx({ vpas, deployments }));

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('recommendation mode');
  });

  it('passes when at least one valid VPA is update-enabled', async () => {
    const deployments = [{ metadata: { namespace: 'default', name: 'api' } }];
    const vpas = [
      {
        metadata: { namespace: 'default', name: 'api-vpa' },
        spec: {
          targetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'api' },
          updatePolicy: { updateMode: 'Auto' },
        },
      },
    ];
    const result = await vpaConfigurationSanityCheck.run(createMockCtx({ vpas, deployments }));

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Checked 1');
  });
});
