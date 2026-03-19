import { describe, it, expect, vi } from 'vitest';
import { hardcodedSecretsCheck } from './hardcoded-secrets.js';
import { Pillar, CheckStatus } from '../../types.js';
import type { AssessmentRunContext } from '../../types.js';

function createMockContext(overrides: Partial<{
  listDeploymentForAllNamespaces: () => Promise<unknown>;
  listStatefulSetForAllNamespaces: () => Promise<unknown>;
}>): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces:
          overrides.listDeploymentForAllNamespaces ?? vi.fn().mockResolvedValue({ items: [] }),
        listStatefulSetForAllNamespaces:
          overrides.listStatefulSetForAllNamespaces ?? vi.fn().mockResolvedValue({ items: [] }),
      },
    } as never,
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test',
    mode: 'full' as never,
  };
}

describe('hardcodedSecretsCheck', () => {
  it('has correct metadata', () => {
    expect(hardcodedSecretsCheck.id).toBe('security.hardcoded-secrets');
    expect(hardcodedSecretsCheck.name).toBe('Hardcoded Secrets in Workloads');
    expect(hardcodedSecretsCheck.pillar).toBe(Pillar.Security);
  });

  it('returns Passing when no workloads have hardcoded secrets', async () => {
    const ctx = createMockContext({
      listDeploymentForAllNamespaces: async () => ({
        items: [
          {
            metadata: { namespace: 'default', name: 'app' },
            spec: {
              template: {
                spec: {
                  containers: [
                    {
                      name: 'app',
                      env: [
                        { name: 'HOST', value: 'localhost' },
                        { name: 'password', value: 'changeme' },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      }),
      listStatefulSetForAllNamespaces: async () => ({ items: [] }),
    });

    const result = await hardcodedSecretsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('returns Failing when Deployment has hardcoded secret in env', async () => {
    const ctx = createMockContext({
      listDeploymentForAllNamespaces: async () => ({
        items: [
          {
            metadata: { namespace: 'prod', name: 'api' },
            spec: {
              template: {
                spec: {
                  containers: [
                    {
                      name: 'api',
                      env: [
                        { name: 'API_TOKEN', value: 'sk-abc123xyz456789' },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      }),
      listStatefulSetForAllNamespaces: async () => ({ items: [] }),
    });

    const result = await hardcodedSecretsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('prod/api');
    expect(result.remediation).toBeDefined();
  });

  it('returns Passing when env uses valueFrom (secretKeyRef)', async () => {
    const ctx = createMockContext({
      listDeploymentForAllNamespaces: async () => ({
        items: [
          {
            metadata: { namespace: 'default', name: 'app' },
            spec: {
              template: {
                spec: {
                  containers: [
                    {
                      name: 'app',
                      env: [
                        {
                          name: 'PASSWORD',
                          valueFrom: { secretKeyRef: { name: 'db-secret', key: 'password' } },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      }),
      listStatefulSetForAllNamespaces: async () => ({ items: [] }),
    });

    const result = await hardcodedSecretsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
  });
});
