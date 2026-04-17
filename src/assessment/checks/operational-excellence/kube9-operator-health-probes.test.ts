import { describe, it, expect, vi } from 'vitest';
import { kube9OperatorHealthProbesCheck } from './kube9-operator-health-probes.js';
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
          containers: [
            {
              name: 'operator',
              ports: [{ name: 'http', containerPort: 8080 }],
              livenessProbe: {
                httpGet: { path: '/healthz', port: 8080 },
              },
              readinessProbe: {
                httpGet: { path: '/readyz', port: 8080 },
              },
            },
          ],
        },
      },
    },
    ...overrides,
  };
}

describe('kube9OperatorHealthProbesCheck', () => {
  it('skips when no kube9-operator Deployment exists', async () => {
    const ctx = createMockCtx([]);
    const result = await kube9OperatorHealthProbesCheck.run(ctx);

    expect(result.checkId).toBe('operational-excellence.kube9-operator-health-probes');
    expect(result.pillar).toBe(Pillar.OperationalExcellence);
    expect(result.status).toBe(CheckStatus.Skipped);
    expect(result.message).toContain('No kube9-operator Deployment found');
  });

  it('passes when Deployment matches operator health contract', async () => {
    const ctx = createMockCtx([compliantDeployment()]);
    const result = await kube9OperatorHealthProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('compliant');
  });

  it('fails when liveness path is wrong', async () => {
    const dep = compliantDeployment();
    const containers = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template
      .spec.containers;
    (containers[0] as { livenessProbe: { httpGet: { path: string } } }).livenessProbe.httpGet.path =
      '/health';

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorHealthProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('/healthz');
    expect(result.remediation).toBeDefined();
  });

  it('fails when readiness probe is missing', async () => {
    const dep = compliantDeployment();
    const c = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template.spec
      .containers[0] as { readinessProbe?: unknown };
    delete c.readinessProbe;

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorHealthProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('readinessProbe');
  });

  it('fails when liveness and readiness target different ports', async () => {
    const dep = compliantDeployment();
    const c = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template.spec
      .containers[0] as {
      readinessProbe: { httpGet: { port: number } };
    };
    c.readinessProbe.httpGet.port = 9090;

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorHealthProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('same HTTP port');
  });
});
