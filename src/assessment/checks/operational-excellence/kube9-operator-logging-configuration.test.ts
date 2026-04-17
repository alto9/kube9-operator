import { describe, it, expect, vi } from 'vitest';
import { kube9OperatorLoggingConfigurationCheck } from './kube9-operator-logging-configuration.js';
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
                { name: 'LOG_LEVEL', value: 'info' },
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

describe('kube9OperatorLoggingConfigurationCheck', () => {
  it('skips when no kube9-operator Deployment exists', async () => {
    const ctx = createMockCtx([]);
    const result = await kube9OperatorLoggingConfigurationCheck.run(ctx);

    expect(result.checkId).toBe('operational-excellence.kube9-operator-logging-configuration');
    expect(result.pillar).toBe(Pillar.OperationalExcellence);
    expect(result.status).toBe(CheckStatus.Skipped);
  });

  it('passes when LOG_LEVEL is a supported value', async () => {
    const ctx = createMockCtx([compliantDeployment()]);
    const result = await kube9OperatorLoggingConfigurationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('LOG_LEVEL');
  });

  it('passes when LOG_LEVEL uses mixed case', async () => {
    const dep = compliantDeployment();
    const env = (dep as { spec: { template: { spec: { containers: { env: unknown[] }[] } } } }).spec
      .template.spec.containers[0].env;
    (env[0] as { value: string }).value = 'WARN';

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorLoggingConfigurationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('warns when LOG_LEVEL is debug', async () => {
    const dep = compliantDeployment();
    const env = (dep as { spec: { template: { spec: { containers: { env: unknown[] }[] } } } }).spec
      .template.spec.containers[0].env;
    (env[0] as { value: string }).value = 'debug';

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorLoggingConfigurationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('debug');
  });

  it('fails when LOG_LEVEL is missing', async () => {
    const dep = compliantDeployment();
    const c = (dep as { spec: { template: { spec: { containers: unknown[] } } } }).spec.template.spec
      .containers[0] as { env: { name: string }[] };
    c.env = c.env.filter((e) => e.name !== 'LOG_LEVEL');

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorLoggingConfigurationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('LOG_LEVEL');
  });

  it('fails when LOG_LEVEL is not supported', async () => {
    const dep = compliantDeployment();
    const env = (dep as { spec: { template: { spec: { containers: { env: unknown[] }[] } } } }).spec
      .template.spec.containers[0].env;
    (env[0] as { value: string }).value = 'trace';

    const ctx = createMockCtx([dep]);
    const result = await kube9OperatorLoggingConfigurationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('trace');
  });
});
