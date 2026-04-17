import { describe, it, expect, vi } from 'vitest';
import { kube9OperatorMetricsExposureCheck } from './kube9-operator-metrics-exposure.js';
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

function baseDeployment(annotations?: Record<string, string>) {
  return {
    metadata: {
      namespace: 'kube9-system',
      name: 'kube9-operator',
      labels: { 'app.kubernetes.io/name': 'kube9-operator' },
    },
    spec: {
      template: {
        metadata: annotations ? { annotations } : {},
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
  };
}

describe('kube9OperatorMetricsExposureCheck', () => {
  it('skips when no kube9-operator Deployment exists', async () => {
    const ctx = createMockCtx([]);
    const result = await kube9OperatorMetricsExposureCheck.run(ctx);

    expect(result.checkId).toBe('operational-excellence.kube9-operator-metrics-exposure');
    expect(result.pillar).toBe(Pillar.OperationalExcellence);
    expect(result.status).toBe(CheckStatus.Skipped);
  });

  it('passes when containerPorts align with probe ports', async () => {
    const ctx = createMockCtx([baseDeployment()]);
    const result = await kube9OperatorMetricsExposureCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('metrics');
  });

  it('fails when containerPorts omit the probe port', async () => {
    const dep = baseDeployment();
    const c = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template.spec
      .containers[0] as { ports: unknown[] };
    c.ports = [];

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorMetricsExposureCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('containerPorts');
    expect(result.remediation).toBeDefined();
  });

  it('warns when prometheus.io/scrape is explicitly false', async () => {
    const dep = baseDeployment({ 'prometheus.io/scrape': 'false' });
    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorMetricsExposureCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('prometheus.io/scrape');
  });
});
