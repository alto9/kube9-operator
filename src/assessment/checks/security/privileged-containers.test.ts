import { describe, it, expect, vi } from 'vitest';
import { privilegedContainersCheck } from './privileged-containers.js';
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

describe('privilegedContainersCheck', () => {
  it('passes when no containers are privileged', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'pod1' },
        spec: {
          containers: [
            { name: 'c1', securityContext: { privileged: false } },
            { name: 'c2' },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await privilegedContainersCheck.run(ctx);

    expect(result.checkId).toBe('security.privileged-containers');
    expect(result.pillar).toBe(Pillar.Security);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('No privileged');
  });

  it('fails when a container has privileged: true', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'privileged-pod' },
        spec: {
          containers: [
            {
              name: 'privileged-container',
              securityContext: { privileged: true },
            },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await privilegedContainersCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/privileged-pod');
    expect(result.message).toContain('privileged-container');
    expect(result.remediation).toBeDefined();
  });

  it('fails when multiple pods have privileged containers', async () => {
    const pods = [
      {
        metadata: { namespace: 'ns1', name: 'pod1' },
        spec: {
          containers: [{ name: 'c1', securityContext: { privileged: true } }],
        },
      },
      {
        metadata: { namespace: 'ns2', name: 'pod2' },
        spec: {
          containers: [{ name: 'c2', securityContext: { privileged: true } }],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await privilegedContainersCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('ns1/pod1');
    expect(result.message).toContain('ns2/pod2');
  });

  it('passes when no pods exist', async () => {
    const ctx = createMockCtx([]);
    const result = await privilegedContainersCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when initContainer has privileged: true', async () => {
    const pods = [
      {
        metadata: { namespace: 'default', name: 'init-priv-pod' },
        spec: {
          containers: [{ name: 'main' }],
          initContainers: [
            { name: 'init', securityContext: { privileged: true } },
          ],
        },
      },
    ];
    const ctx = createMockCtx(pods);
    const result = await privilegedContainersCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/init-priv-pod');
    expect(result.message).toContain('init');
  });
});
