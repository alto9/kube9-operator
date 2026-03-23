import { describe, it, expect, vi } from 'vitest';
import { resourceLimitsCheck } from './resource-limits.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  deployments: unknown[] = [],
  statefulSets: unknown[] = [],
  daemonSets: unknown[] = []
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

describe('resourceLimitsCheck', () => {
  it('passes when all containers have CPU and memory limits', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                    limits: { cpu: '500m', memory: '256Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.checkId).toBe('reliability.resource-limits');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('limits');
  });

  it('warns when container missing CPU limit', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-cpu-limit' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                    limits: { memory: '256Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('default/no-cpu-limit');
    expect(result.message).toContain('cpu limit');
    expect(result.remediation).toBeDefined();
  });

  it('warns when container missing memory limit', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-mem-limit' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                    limits: { cpu: '500m' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('memory limit');
  });

  it('warns when init container missing limits', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'init-burstable' },
        spec: {
          template: {
            spec: {
              initContainers: [
                {
                  name: 'init',
                  resources: { requests: { cpu: '50m', memory: '64Mi' } },
                },
              ],
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                    limits: { cpu: '500m', memory: '256Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('init');
    expect(result.message).toContain('cpu limit');
  });

  it('warns when sidecar missing limits', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'with-sidecar' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                    limits: { cpu: '500m', memory: '256Mi' },
                  },
                },
                {
                  name: 'sidecar',
                  resources: { requests: { cpu: '10m', memory: '32Mi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('sidecar');
  });

  it('skips workloads in kube-system', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'coredns' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: { requests: { cpu: '100m', memory: '128Mi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('skips workloads with resource-exempt label', async () => {
    const deployments = [
      {
        metadata: {
          namespace: 'default',
          name: 'exempt',
          labels: { 'kube9.io/resource-exempt': 'true' },
        },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: { requests: { cpu: '100m', memory: '128Mi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no workloads exist', async () => {
    const ctx = createMockCtx();
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('messages name workload and what is missing (limit)', async () => {
    const deployments = [
      {
        metadata: { namespace: 'prod', name: 'api' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'server',
                  resources: { requests: { cpu: '200m', memory: '256Mi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceLimitsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toMatch(/prod\/api.*Deployment/);
    expect(result.message).toContain('server');
    expect(result.message).toContain('cpu limit');
    expect(result.message).toContain('memory limit');
  });
});
