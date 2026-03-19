import { describe, it, expect, vi } from 'vitest';
import { runAsNonRootCheck } from './run-as-non-root.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(pods: unknown[]): AssessmentRunContext {
  return {
    kubernetes: {
      coreApi: {
        listPodForAllNamespaces: vi.fn().mockResolvedValue({ items: pods }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('runAsNonRootCheck', () => {
  it('passes when all pods and containers have runAsNonRoot: true', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'pod1' },
        spec: {
          securityContext: { runAsNonRoot: true },
          containers: [
            { name: 'c1', securityContext: { runAsNonRoot: true } },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await runAsNonRootCheck.run(ctx);

    expect(result.checkId).toBe('security.run-as-non-root');
    expect(result.pillar).toBe(Pillar.Security);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('non-root');
  });

  it('passes when pod has runAsNonRoot and containers inherit', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'pod1' },
        spec: {
          securityContext: { runAsNonRoot: true },
          containers: [{ name: 'c1' }],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await runAsNonRootCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when pod has runAsNonRoot: false', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'bad-pod' },
        spec: {
          securityContext: { runAsNonRoot: false },
          containers: [{ name: 'c1' }],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await runAsNonRootCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/bad-pod');
    expect(result.remediation).toBeDefined();
  });

  it('fails when container overrides with runAsNonRoot: false', async () => {
    const pods = [
      {
        metadata: { namespace: 'ns1', name: 'pod1' },
        spec: {
          securityContext: { runAsNonRoot: true },
          containers: [
            {
              name: 'bad-container',
              securityContext: { runAsNonRoot: false },
            },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await runAsNonRootCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('ns1/pod1');
    expect(result.message).toContain('bad-container');
  });

  it('fails when runAsNonRoot is missing at both levels', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'no-context-pod' },
        spec: {
          containers: [{ name: 'c1' }],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await runAsNonRootCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('no-context-pod');
  });

  it('passes when no pods exist', async () => {
    const ctx = createMockCtx([]);
    const result = await runAsNonRootCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });
});
