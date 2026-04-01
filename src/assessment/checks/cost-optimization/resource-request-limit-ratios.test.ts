import { describe, it, expect, vi } from 'vitest';
import { resourceRequestLimitRatiosCheck } from './resource-request-limit-ratios.js';
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

describe('resourceRequestLimitRatiosCheck', () => {
  it('passes when no workloads or no request+limit pairs', async () => {
    const ctx = createMockCtx([]);
    const result = await resourceRequestLimitRatiosCheck.run(ctx);

    expect(result.checkId).toBe('cost-optimization.resource-request-limit-ratios');
    expect(result.pillar).toBe(Pillar.CostOptimization);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when request/limit ratios are healthy', async () => {
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
                    requests: { cpu: '500m', memory: '256Mi' },
                    limits: { cpu: '2', memory: '512Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestLimitRatiosCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when CPU request/limit ratio is extremely low', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'burst' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '10m', memory: '128Mi' },
                    limits: { cpu: '4', memory: '512Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestLimitRatiosCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('CPU');
    expect(result.message).toContain('below 5%');
    expect(result.severity).toBeDefined();
  });

  it('warns when ratio is in warning band', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'warn-case' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '150m', memory: '128Mi' },
                    limits: { cpu: '1', memory: '512Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestLimitRatiosCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('below 20%');
  });

  it('fails when CPU request exceeds limit', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'bad' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '2', memory: '128Mi' },
                    limits: { cpu: '1', memory: '512Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestLimitRatiosCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('exceeds limit');
  });

  it('skips kube-system workloads', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'bad' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  resources: {
                    requests: { cpu: '10m', memory: '128Mi' },
                    limits: { cpu: '4', memory: '512Mi' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await resourceRequestLimitRatiosCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });
});
