import { describe, it, expect, vi } from 'vitest';
import { kube9OperatorDeploymentStrategyCheck } from './kube9-operator-deployment-strategy.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(deployments: unknown[] = []): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

function kube9Deployment(overrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      namespace: 'kube9-system',
      name: 'kube9-operator',
      labels: { 'app.kubernetes.io/name': 'kube9-operator' },
    },
    spec: {
      replicas: 1,
      strategy: { type: 'Recreate' },
      template: { spec: { containers: [{ name: 'operator' }] } },
    },
    ...overrides,
  };
}

describe('kube9OperatorDeploymentStrategyCheck', () => {
  it('skips when no kube9-operator Deployment exists', async () => {
    const ctx = createMockCtx([]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.checkId).toBe('operational-excellence.kube9-operator-deployment-strategy');
    expect(result.pillar).toBe(Pillar.OperationalExcellence);
    expect(result.status).toBe(CheckStatus.Skipped);
    expect(result.message).toContain('No kube9-operator Deployment');
  });

  it('passes for single-replica Recreate (chart-style PVC-friendly rollout)', async () => {
    const ctx = createMockCtx([kube9Deployment()]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('acceptable');
  });

  it('fails for Recreate with multiple replicas', async () => {
    const dep = kube9Deployment({
      spec: {
        replicas: 3,
        strategy: { type: 'Recreate' },
        template: { spec: { containers: [{ name: 'operator' }] } },
      },
    });
    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('Recreate');
    expect(result.message).toContain('3 replicas');
  });

  it('fails for RollingUpdate when maxUnavailable takes all pods on HA', async () => {
    const dep = kube9Deployment({
      spec: {
        replicas: 2,
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxUnavailable: '100%', maxSurge: '0' },
        },
        template: { spec: { containers: [{ name: 'operator' }] } },
      },
    });
    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('maxUnavailable');
  });

  it('fails for RollingUpdate when integer maxUnavailable equals replica count', async () => {
    const dep = kube9Deployment({
      spec: {
        replicas: 2,
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxUnavailable: 2, maxSurge: 1 },
        },
        template: { spec: { containers: [{ name: 'operator' }] } },
      },
    });
    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
  });

  it('passes for RollingUpdate with two replicas and default disruption (25%)', async () => {
    const dep = kube9Deployment({
      spec: {
        replicas: 2,
        strategy: { type: 'RollingUpdate', rollingUpdate: {} },
        template: { spec: { containers: [{ name: 'operator' }] } },
      },
    });
    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('warns when progressDeadlineSeconds is very low', async () => {
    const dep = kube9Deployment({
      spec: {
        replicas: 1,
        strategy: { type: 'Recreate' },
        progressDeadlineSeconds: 60,
        template: { spec: { containers: [{ name: 'operator' }] } },
      },
    });
    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorDeploymentStrategyCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('progressDeadlineSeconds');
  });
});
