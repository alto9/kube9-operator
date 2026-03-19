import { describe, it, expect, vi } from 'vitest';
import { externalSecretsUsageCheck } from './external-secrets-usage.js';
import { Pillar, CheckStatus } from '../../types.js';
import type { AssessmentRunContext } from '../../types.js';

function createMockContext(overrides: Partial<{
  readCustomResourceDefinition: (opts: { name: string }) => Promise<unknown>;
}>): AssessmentRunContext {
  return {
    kubernetes: {
      apiextensionsApi: {
        readCustomResourceDefinition:
          overrides.readCustomResourceDefinition ??
          vi.fn().mockResolvedValue({ metadata: { name: 'externalsecrets.external-secrets.io' } }),
      },
    } as never,
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test',
    mode: 'full' as never,
  };
}

describe('externalSecretsUsageCheck', () => {
  it('has correct metadata', () => {
    expect(externalSecretsUsageCheck.id).toBe('security.external-secrets-usage');
    expect(externalSecretsUsageCheck.name).toBe('External Secrets Usage');
    expect(externalSecretsUsageCheck.pillar).toBe(Pillar.Security);
  });

  it('returns Passing when ExternalSecret CRD exists', async () => {
    const ctx = createMockContext({
      readCustomResourceDefinition: async () => ({ metadata: { name: 'externalsecrets.external-secrets.io' } }),
    });

    const result = await externalSecretsUsageCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('external-secrets operator is installed');
  });

  it('returns Warning when ExternalSecret CRD does not exist (404)', async () => {
    const err = new Error('Not Found');
    (err as { response?: { statusCode?: number } }).response = { statusCode: 404 };

    const ctx = createMockContext({
      readCustomResourceDefinition: async () => {
        throw err;
      },
    });

    const result = await externalSecretsUsageCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('external-secrets operator not detected');
  });

  it('throws when CRD read fails with non-404', async () => {
    const ctx = createMockContext({
      readCustomResourceDefinition: async () => {
        throw new Error('Server error');
      },
    });

    await expect(externalSecretsUsageCheck.run(ctx)).rejects.toThrow('Server error');
  });
});
