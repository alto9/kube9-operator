import { describe, it, expect, vi } from 'vitest';
import { resourceRequestsCheck } from './resource-requests.js';
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

describe('resourceRequestsCheck', () => {
  it('passes when all containers have CPU and memory requests', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
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
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.checkId).toBe('reliability.resource-requests');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('requests');
  });

  it('fails when Deployment container missing CPU request', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-cpu' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: { requests: { memory: '128Mi' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/no-cpu');
    expect(result.message).toContain('cpu request');
    expect(result.remediation).toBeDefined();
  });

  it('fails when container missing memory request', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-mem' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: { requests: { cpu: '100m' } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('memory request');
  });

  it('fails when init container missing requests', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'init-missing' },
        spec: {
          template: {
            spec: {
              initContainers: [{ name: 'init', resources: {} }],
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
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('init');
    expect(result.message).toContain('cpu request');
  });

  it('skips workloads in kube-system', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'coredns' },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'main', resources: {} }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestsCheck.run(ctx);

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
              containers: [{ name: 'main', resources: {} }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no workloads exist', async () => {
    const ctx = createMockCtx();
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when StatefulSet container missing requests', async () => {
    const statefulSets = [
      {
        metadata: { namespace: 'default', name: 'db' },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'postgres', resources: {} }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx([], statefulSets);
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/db');
    expect(result.message).toContain('StatefulSet');
  });

  it('fails when DaemonSet container missing requests', async () => {
    const daemonSets = [
      {
        metadata: { namespace: 'default', name: 'node-logger' },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'logger', resources: {} }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx([], [], daemonSets);
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/node-logger');
    expect(result.message).toContain('DaemonSet');
  });

  it('messages name workload and what is missing (request vs limit)', async () => {
    const deployments = [
      {
        metadata: { namespace: 'my-ns', name: 'my-app' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'sidecar',
                  resources: {},
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toMatch(/my-ns\/my-app.*Deployment/);
    expect(result.message).toContain('sidecar');
    expect(result.message).toContain('cpu request');
    expect(result.message).toContain('memory request');
  });
});
