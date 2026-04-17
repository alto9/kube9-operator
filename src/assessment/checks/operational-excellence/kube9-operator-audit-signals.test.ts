import { describe, it, expect, vi } from 'vitest';
import { kube9OperatorAuditSignalsCheck } from './kube9-operator-audit-signals.js';
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

function compliantDeployment(overrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      namespace: 'kube9-system',
      name: 'kube9-operator',
      labels: { 'app.kubernetes.io/name': 'kube9-operator' },
    },
    spec: {
      template: {
        spec: {
          serviceAccountName: 'kube9-operator',
          containers: [
            {
              name: 'operator',
              env: [
                {
                  name: 'POD_NAMESPACE',
                  valueFrom: { fieldRef: { fieldPath: 'metadata.namespace' } },
                },
              ],
            },
          ],
        },
      },
    },
    ...overrides,
  };
}

describe('kube9OperatorAuditSignalsCheck', () => {
  it('skips when no kube9-operator Deployment exists', async () => {
    const ctx = createMockCtx([]);
    const result = await kube9OperatorAuditSignalsCheck.run(ctx);

    expect(result.checkId).toBe('operational-excellence.kube9-operator-audit-signals');
    expect(result.pillar).toBe(Pillar.OperationalExcellence);
    expect(result.status).toBe(CheckStatus.Skipped);
  });

  it('passes when POD_NAMESPACE uses the downward API and a dedicated SA is set', async () => {
    const ctx = createMockCtx([compliantDeployment()]);
    const result = await kube9OperatorAuditSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('POD_NAMESPACE');
  });

  it('fails when POD_NAMESPACE is absent', async () => {
    const dep = compliantDeployment();
    const c = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template.spec
      .containers[0] as { env: unknown[] };
    c.env = [];

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorAuditSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('POD_NAMESPACE');
  });

  it('fails when POD_NAMESPACE is a literal instead of fieldRef', async () => {
    const dep = compliantDeployment();
    const c = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template.spec
      .containers[0] as { env: unknown[] };
    c.env = [{ name: 'POD_NAMESPACE', value: 'kube9-system' }];

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorAuditSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('fieldRef');
  });

  it('fails when serviceAccountName is default', async () => {
    const dep = compliantDeployment();
    (dep as { spec: { template: { spec: { serviceAccountName: string } } } }).spec.template.spec.serviceAccountName =
      'default';

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorAuditSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('ServiceAccount');
  });

  it('fails when serviceAccountName is omitted', async () => {
    const dep = compliantDeployment();
    delete (dep as { spec: { template: { spec: { serviceAccountName?: string } } } }).spec.template.spec
      .serviceAccountName;

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorAuditSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('ServiceAccount');
  });
});
