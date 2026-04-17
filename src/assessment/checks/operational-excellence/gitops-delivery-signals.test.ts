import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gitopsDeliverySignalsCheck } from './gitops-delivery-signals.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

const notFound = Object.assign(new Error('not found'), {
  response: { statusCode: 404 },
});

function createMockCtx(kubernetes: Record<string, unknown>): AssessmentRunContext {
  return {
    kubernetes,
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

describe('gitopsDeliverySignalsCheck', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.ARGOCD_ENABLED;
    delete process.env.ARGOCD_AUTO_DETECT;
    delete process.env.ARGOCD_NAMESPACE;
    delete process.env.ARGOCD_SELECTOR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('passes when Argo CD is detected (CRD, namespace, server Deployment)', async () => {
    const readCustomResourceDefinition = vi.fn(async ({ name }: { name: string }) => {
      if (name === 'applications.argoproj.io') {
        return { metadata: { name } };
      }
      throw notFound;
    });
    const readNamespace = vi.fn().mockResolvedValue({ metadata: { name: 'argocd' } });
    const listNamespacedDeployment = vi.fn().mockResolvedValue({
      items: [
        {
          metadata: { labels: { 'app.kubernetes.io/version': 'v2.10.0' } },
          spec: { template: { spec: { containers: [{ name: 'argocd-server', image: 'quay.io/argoproj/argocd:v2.10.0' }] } } },
        },
      ],
    });

    const ctx = createMockCtx({
      apiextensionsApi: { readCustomResourceDefinition },
      coreApi: { readNamespace },
      appsApi: { listNamespacedDeployment },
    });

    const result = await gitopsDeliverySignalsCheck.run(ctx);

    expect(result.checkId).toBe('operational-excellence.gitops-delivery-signals');
    expect(result.pillar).toBe(Pillar.OperationalExcellence);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Argo CD detected');
  });

  it('passes when Flux GitOps CRD is present without Argo CD', async () => {
    const readCustomResourceDefinition = vi.fn(async ({ name }: { name: string }) => {
      if (name === 'kustomizations.kustomize.toolkit.fluxcd.io') {
        return { metadata: { name } };
      }
      throw notFound;
    });

    const ctx = createMockCtx({
      apiextensionsApi: { readCustomResourceDefinition },
      coreApi: { readNamespace: vi.fn() },
      appsApi: { listNamespacedDeployment: vi.fn() },
    });

    const result = await gitopsDeliverySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('Flux');
  });

  it('warns when no GitOps signals are present', async () => {
    const readCustomResourceDefinition = vi.fn().mockRejectedValue(notFound);

    const ctx = createMockCtx({
      apiextensionsApi: { readCustomResourceDefinition },
      coreApi: { readNamespace: vi.fn() },
      appsApi: { listNamespacedDeployment: vi.fn() },
    });

    const result = await gitopsDeliverySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('No Argo CD or Flux');
  });

  it('warns when Argo Application CRD exists but server Deployment is missing', async () => {
    const readCustomResourceDefinition = vi.fn(async ({ name }: { name: string }) => {
      if (name === 'applications.argoproj.io') {
        return { metadata: { name } };
      }
      throw notFound;
    });
    const readNamespace = vi.fn().mockResolvedValue({ metadata: { name: 'argocd' } });
    const listNamespacedDeployment = vi.fn().mockResolvedValue({ items: [] });

    const ctx = createMockCtx({
      apiextensionsApi: { readCustomResourceDefinition },
      coreApi: { readNamespace },
      appsApi: { listNamespacedDeployment },
    });

    const result = await gitopsDeliverySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('incomplete');
    expect(result.remediation).toContain('ARGOCD_NAMESPACE');
  });

  it('warns when ARGOCD_ENABLED=true but server Deployment is not found', async () => {
    process.env.ARGOCD_ENABLED = 'true';

    const readCustomResourceDefinition = vi.fn().mockRejectedValue(notFound);
    const readNamespace = vi.fn().mockResolvedValue({ metadata: { name: 'argocd' } });
    const listNamespacedDeployment = vi.fn().mockResolvedValue({ items: [] });

    const ctx = createMockCtx({
      apiextensionsApi: { readCustomResourceDefinition },
      coreApi: { readNamespace },
      appsApi: { listNamespacedDeployment },
    });

    const result = await gitopsDeliverySignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('ARGOCD_ENABLED=true');
  });
});
