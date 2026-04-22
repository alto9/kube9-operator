import { describe, it, expect, vi } from 'vitest';
import {
  workloadConsolidationSignalsCheck,
  MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL,
  SINGLE_REPLICA_DEPLOYMENT_SHARE_WARN,
} from './workload-consolidation-signals.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(deployments: unknown[]): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: deployments }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

function deployment(ns: string, name: string, replicas: number | undefined): unknown {
  return {
    metadata: { namespace: ns, name },
    spec: replicas === undefined ? {} : { replicas },
  };
}

describe('workloadConsolidationSignalsCheck', () => {
  it('uses sustainability pillar and stable check id', () => {
    expect(workloadConsolidationSignalsCheck.id).toBe('sustainability.workload-consolidation-signals');
    expect(workloadConsolidationSignalsCheck.pillar).toBe(Pillar.Sustainability);
  });

  it('passes when too few in-scope deployments', async () => {
    const items = Array.from({ length: MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL - 1 }, (_, i) =>
      deployment('default', `app-${i}`, 1),
    );
    const ctx = createMockCtx(items);
    const result = await workloadConsolidationSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain(`Only ${MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL - 1}`);
    expect(result.pillar).toBe(Pillar.Sustainability);
  });

  it('warns when most in-scope deployments are single-replica', async () => {
    const n = MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL;
    const single = Math.ceil(n * SINGLE_REPLICA_DEPLOYMENT_SHARE_WARN);
    const multi = n - single;
    const items: unknown[] = [];
    for (let i = 0; i < single; i++) items.push(deployment('default', `one-${i}`, 1));
    for (let i = 0; i < multi; i++) items.push(deployment('default', `many-${i}`, 3));
    const ctx = createMockCtx(items);
    const result = await workloadConsolidationSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('single-replica');
  });

  it('passes when single-replica share is below threshold', async () => {
    const n = MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL;
    const single = Math.floor(n * SINGLE_REPLICA_DEPLOYMENT_SHARE_WARN) - 1;
    const multi = n - single;
    const items: unknown[] = [];
    for (let i = 0; i < single; i++) items.push(deployment('default', `one-${i}`, 1));
    for (let i = 0; i < multi; i++) items.push(deployment('default', `many-${i}`, 2));
    const ctx = createMockCtx(items);
    const result = await workloadConsolidationSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('nominal');
  });

  it('excludes kube-system and scaled-to-zero deployments', async () => {
    const items: unknown[] = [];
    for (let i = 0; i < 10; i++) items.push(deployment('default', `app-${i}`, 1));
    for (let i = 0; i < 10; i++) items.push(deployment('kube-system', `sys-${i}`, 1));
    items.push(deployment('default', 'scaled-down', 0));
    const ctx = createMockCtx(items);
    const result = await workloadConsolidationSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
    expect(result.message).toContain('10 of 10');
  });

  it('treats omitted replicas as one', async () => {
    const items: unknown[] = [];
    for (let i = 0; i < MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL; i++) {
      items.push({ metadata: { namespace: 'default', name: `no-replicas-${i}` }, spec: {} });
    }
    const ctx = createMockCtx(items);
    const result = await workloadConsolidationSignalsCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Warning);
  });
});
