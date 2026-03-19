import { describe, it, expect, vi } from 'vitest';
import { capabilitiesValidationCheck } from './capabilities-validation.js';
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

describe('capabilitiesValidationCheck', () => {
  it('passes when no dangerous capabilities are added', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'pod1' },
        spec: {
          containers: [
            { name: 'c1', securityContext: { capabilities: { drop: ['ALL'] } } },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await capabilitiesValidationCheck.run(ctx);

    expect(result.checkId).toBe('security.capabilities-validation');
    expect(result.pillar).toBe(Pillar.Security);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('No dangerous');
  });

  it('passes when SYS_ADMIN is added but drop ALL is set', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'pod1' },
        spec: {
          containers: [
            {
              name: 'c1',
              securityContext: {
                capabilities: { add: ['SYS_ADMIN'], drop: ['ALL'] },
              },
            },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await capabilitiesValidationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when SYS_ADMIN is added without drop ALL', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'bad-pod' },
        spec: {
          containers: [
            {
              name: 'c1',
              securityContext: {
                capabilities: { add: ['SYS_ADMIN'] },
              },
            },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await capabilitiesValidationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/bad-pod');
    expect(result.message).toContain('SYS_ADMIN');
    expect(result.remediation).toBeDefined();
  });

  it('fails when NET_ADMIN is added without drop', async () => {
    const pods = [
      {
        metadata: { namespace: 'ns1', name: 'pod1' },
        spec: {
          containers: [
            {
              name: 'c1',
              securityContext: {
                capabilities: { add: ['NET_ADMIN'] },
              },
            },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await capabilitiesValidationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('NET_ADMIN');
  });

  it('passes when only safe capabilities like NET_BIND_SERVICE are added', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'pod1' },
        spec: {
          containers: [
            {
              name: 'c1',
              securityContext: {
                capabilities: { add: ['NET_BIND_SERVICE'] },
              },
            },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await capabilitiesValidationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no pods exist', async () => {
    const ctx = createMockCtx([]);
    const result = await capabilitiesValidationCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });
});
