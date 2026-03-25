import { describe, it, expect, vi } from 'vitest';
import { namespaceResourceGovernanceCheck } from './namespace-resource-governance.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

interface MockArgs {
  namespaces?: unknown[];
  deployments?: unknown[];
  statefulSets?: unknown[];
  daemonSets?: unknown[];
  resourceQuotas?: unknown[];
  limitRanges?: unknown[];
}

function createMockCtx(args: MockArgs = {}): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: args.deployments ?? [] }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: args.statefulSets ?? [] }),
        listDaemonSetForAllNamespaces: vi.fn().mockResolvedValue({ items: args.daemonSets ?? [] }),
      },
      coreApi: {
        listResourceQuotaForAllNamespaces: vi.fn().mockResolvedValue({ items: args.resourceQuotas ?? [] }),
        listLimitRangeForAllNamespaces: vi.fn().mockResolvedValue({ items: args.limitRanges ?? [] }),
        listNamespace: vi.fn().mockResolvedValue({ items: args.namespaces ?? [] }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

function deployment(args: {
  namespace: string;
  name: string;
  replicas?: number;
  cpuRequest?: string;
  memoryRequest?: string;
}): unknown {
  return {
    metadata: { namespace: args.namespace, name: args.name },
    spec: {
      replicas: args.replicas ?? 1,
      template: {
        spec: {
          containers: [
            {
              name: 'main',
              resources: {
                requests: {
                  cpu: args.cpuRequest,
                  memory: args.memoryRequest,
                },
              },
            },
          ],
        },
      },
    },
  };
}

describe('namespaceResourceGovernanceCheck', () => {
  it('passes when no in-scope workloads are present', async () => {
    const result = await namespaceResourceGovernanceCheck.run(createMockCtx());
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('not applicable');
  });

  it('warns when production-like namespace has no ResourceQuota', async () => {
    const result = await namespaceResourceGovernanceCheck.run(
      createMockCtx({
        deployments: [
          deployment({ namespace: 'prod-api', name: 'api', replicas: 2, cpuRequest: '500m', memoryRequest: '512Mi' }),
        ],
        namespaces: [{ metadata: { name: 'prod-api' } }],
      }),
    );

    expect(result.checkId).toBe('performance-efficiency.namespace-resource-governance');
    expect(result.pillar).toBe(Pillar.PerformanceEfficiency);
    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('no ResourceQuota');
  });

  it('fails when quota hard limit is below estimated namespace demand', async () => {
    const result = await namespaceResourceGovernanceCheck.run(
      createMockCtx({
        deployments: [
          deployment({ namespace: 'production', name: 'api', replicas: 2, cpuRequest: '600m', memoryRequest: '512Mi' }),
        ],
        namespaces: [{ metadata: { name: 'production' } }],
        resourceQuotas: [
          {
            metadata: { namespace: 'production', name: 'rq-tight' },
            spec: {
              hard: {
                'requests.cpu': '1',
                'requests.memory': '2Gi',
                pods: '2',
              },
            },
          },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('likely scheduling failures');
    expect(result.objectKind).toBe('ResourceQuota');
    expect(result.objectNamespace).toBe('production');
  });

  it('warns when quota is too loose relative to estimated workload demand', async () => {
    const result = await namespaceResourceGovernanceCheck.run(
      createMockCtx({
        deployments: [
          deployment({ namespace: 'prod', name: 'worker', replicas: 2, cpuRequest: '100m', memoryRequest: '128Mi' }),
        ],
        namespaces: [{ metadata: { name: 'prod' } }],
        resourceQuotas: [
          {
            metadata: { namespace: 'prod', name: 'rq-loose' },
            spec: {
              hard: {
                'requests.cpu': '10',
                'requests.memory': '20Gi',
                'limits.cpu': '20',
                'limits.memory': '40Gi',
                pods: '100',
              },
            },
          },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('too loose');
  });

  it('warns when defaults are missing and workloads omit requests/limits', async () => {
    const result = await namespaceResourceGovernanceCheck.run(
      createMockCtx({
        deployments: [
          {
            metadata: { namespace: 'prod', name: 'api' },
            spec: {
              replicas: 3,
              template: {
                spec: {
                  containers: [{ name: 'main', resources: {} }],
                },
              },
            },
          },
        ],
        namespaces: [{ metadata: { name: 'prod' } }],
        resourceQuotas: [
          {
            metadata: { namespace: 'prod', name: 'rq' },
            spec: { hard: { 'requests.cpu': '6', 'requests.memory': '8Gi', pods: '20' } },
          },
        ],
        limitRanges: [
          {
            metadata: { namespace: 'prod', name: 'limits-no-default' },
            spec: { limits: [{ type: 'Container', max: { cpu: '2', memory: '2Gi' } }] },
          },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('no LimitRange defaults');
  });

  it('passes when quota and defaults are in reasonable range', async () => {
    const result = await namespaceResourceGovernanceCheck.run(
      createMockCtx({
        deployments: [
          deployment({ namespace: 'prod', name: 'api', replicas: 2, cpuRequest: '250m', memoryRequest: '256Mi' }),
        ],
        namespaces: [{ metadata: { name: 'prod' } }],
        resourceQuotas: [
          {
            metadata: { namespace: 'prod', name: 'rq-balanced' },
            spec: {
              hard: {
                'requests.cpu': '2',
                'requests.memory': '3Gi',
                'limits.cpu': '4',
                'limits.memory': '6Gi',
                pods: '10',
              },
            },
          },
        ],
        limitRanges: [
          {
            metadata: { namespace: 'prod', name: 'limits-defaults' },
            spec: {
              limits: [
                {
                  type: 'Container',
                  _default: { cpu: '500m', memory: '512Mi' },
                  defaultRequest: { cpu: '250m', memory: '256Mi' },
                },
              ],
            },
          },
        ],
      }),
    );

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Enumerated');
    expect(result.message).toContain('ResourceQuota=1');
    expect(result.message).toContain('LimitRange=1');
  });
});
