import { describe, it, expect, vi } from 'vitest';
import { secretsInConfigMapsCheck } from './secrets-in-configmaps.js';
import { Pillar, CheckStatus } from '../../types.js';
import type { AssessmentRunContext } from '../../types.js';

function createMockContext(overrides: Partial<{
  listConfigMapForAllNamespaces: () => Promise<unknown>;
}>): AssessmentRunContext {
  return {
    kubernetes: {
      coreApi: {
        listConfigMapForAllNamespaces: overrides.listConfigMapForAllNamespaces ?? vi.fn().mockResolvedValue({ items: [] }),
      },
    } as never,
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test',
    mode: 'full' as never,
  };
}

describe('secretsInConfigMapsCheck', () => {
  it('has correct metadata', () => {
    expect(secretsInConfigMapsCheck.id).toBe('security.secrets-in-configmaps');
    expect(secretsInConfigMapsCheck.name).toBe('Secrets in ConfigMaps');
    expect(secretsInConfigMapsCheck.pillar).toBe(Pillar.Security);
  });

  it('returns Passing when no ConfigMaps have secrets', async () => {
    const ctx = createMockContext({
      listConfigMapForAllNamespaces: async () => ({
        items: [
          { metadata: { namespace: 'default', name: 'app-config' }, data: { HOST: 'localhost', PORT: '8080' } },
        ],
      }),
    });

    const result = await secretsInConfigMapsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('No ConfigMaps');
  });

  it('returns Passing when ConfigMap has placeholder in sensitive key', async () => {
    const ctx = createMockContext({
      listConfigMapForAllNamespaces: async () => ({
        items: [
          { metadata: { namespace: 'default', name: 'app-config' }, data: { password: 'changeme' } },
        ],
      }),
    });

    const result = await secretsInConfigMapsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('returns Failing when ConfigMap has likely secret in sensitive key', async () => {
    const ctx = createMockContext({
      listConfigMapForAllNamespaces: async () => ({
        items: [
          {
            metadata: { namespace: 'prod', name: 'db-config' },
            data: { password: 'myActualSecretPassword123' },
          },
        ],
      }),
    });

    const result = await secretsInConfigMapsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('prod/db-config');
    expect(result.remediation).toBeDefined();
  });
});
