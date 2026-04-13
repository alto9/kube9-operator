import { describe, it, expect, vi } from 'vitest';
import { overProvisioningDetectionCheck } from './over-provisioning-detection.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  deployments: unknown[] = [],
  statefulSets: unknown[] = [],
  daemonSets: unknown[] = [],
): AssessmentRunContext {
  return {
    kubernetes: {
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

describe('overProvisioningDetectionCheck', () => {
  it('passes when no workloads or requests are within thresholds', async () => {
    const ctx = createMockCtx([]);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.checkId).toBe('cost-optimization.over-provisioning-detection');
    expect(result.pillar).toBe(Pillar.CostOptimization);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes for modest per-pod and total reservations', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          replicas: 3,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '500m', memory: '256Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('warns when per-pod CPU requests reach warning threshold', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'big' },
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '4', memory: '128Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('per-pod CPU');
    expect(result.message).toContain('4.00 cores');
  });

  it('fails when per-pod CPU requests reach fail threshold', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'huge' },
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '16', memory: '128Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('per-pod CPU');
    expect(result.message).toContain('16.00');
  });

  it('warns when scaled CPU reservation exceeds total warning threshold', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'wide' },
        spec: {
          replicas: 10,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '4', memory: '128Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('total CPU reservation');
    expect(result.message).toContain('40.00');
  });

  it('warns for high per-pod memory requests', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'mem' },
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '20Gi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('per-pod memory');
  });

  it('uses max(init, app) for effective pod CPU', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'init-heavy' },
        spec: {
          replicas: 1,
          template: {
            spec: {
              initContainers: [
                {
                  name: 'warm',
                  resources: {
                    requests: { cpu: '8', memory: '128Mi' },
                  },
                },
              ],
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toMatch(/8\.00 cores/);
  });

  it('skips kube-system workloads', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'big' },
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '16', memory: '128Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('skips resource-exempt workloads', async () => {
    const deployments = [
      {
        metadata: {
          namespace: 'default',
          name: 'exempt',
          labels: { 'kube9.io/resource-exempt': 'true' },
        },
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '16', memory: '128Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await overProvisioningDetectionCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });
});
