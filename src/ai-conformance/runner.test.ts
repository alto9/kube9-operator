import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { vi } from 'vitest';
import { SchemaManager } from '../database/schema.js';
import { DatabaseManager } from '../database/manager.js';
import { AiConformanceRepository } from '../database/ai-conformance-repository.js';
import { AiConformanceRunner } from './runner.js';
import type { KubernetesClient } from '../kubernetes/client.js';

const testDbDir = path.join(process.cwd(), 'test-ai-conformance-runner-temp');

function mockKubernetes(): KubernetesClient {
  return {
    rbacApi: {
      listClusterRole: vi.fn().mockResolvedValue({ items: [] }),
      listRoleForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      listClusterRoleBinding: vi.fn().mockResolvedValue({ items: [] }),
      listRoleBindingForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    policyApi: {
      listPodDisruptionBudgetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    networkingApi: {
      listNetworkPolicyForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
  } as unknown as KubernetesClient;
}

describe('AiConformanceRunner', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
    process.env.DB_PATH = testDbDir;
  });

  afterAll(() => {
    DatabaseManager.reset();
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    delete process.env.DB_PATH;
  });

  beforeEach(() => {
    DatabaseManager.reset();
    const dbBase = path.join(testDbDir, 'kube9.db');
    for (const file of [dbBase, `${dbBase}-wal`, `${dbBase}-shm`]) {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    }
    const schema = new SchemaManager();
    schema.initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  it('persists a completed run with requirement results', async () => {
    const repo = new AiConformanceRepository();
    const runner = new AiConformanceRunner({
      kubernetes: mockKubernetes(),
      storage: repo,
    });

    const record = await runner.run({
      selection: {
        gitVersion: 'v1.31.0',
        options: { kubernetesMinorOverride: '1.31' },
      },
    });

    expect(record.state).toBe('completed');
    expect(record.total_requirements).toBe(5);
    expect(record.needs_evidence_count).toBeGreaterThanOrEqual(2);

    const results = repo.getRequirementResultsForRun(record.run_id);
    expect(results).toHaveLength(5);
    expect(results.some((r) => r.status === 'needs-evidence')).toBe(true);
  });

  it('persists failed run when checklist selection fails', async () => {
    const repo = new AiConformanceRepository();
    const runner = new AiConformanceRunner({
      kubernetes: mockKubernetes(),
      storage: repo,
    });

    const record = await runner.run({
      selection: {
        options: { kubernetesMinorOverride: '9.99' },
      },
    });

    expect(record.state).toBe('failed');
    expect(record.failure_reason).toBeTruthy();
    expect(record.failure_reason!.length).toBeLessThanOrEqual(120);

    const results = repo.getRequirementResultsForRun(record.run_id);
    expect(results).toHaveLength(0);
  });

  it('does not throw when evaluation dependencies fail at run level', async () => {
    const repo = new AiConformanceRepository();
    const brokenK8s = {
      rbacApi: {
        listClusterRole: vi.fn().mockRejectedValue(new Error('cluster unreachable')),
        listRoleForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listClusterRoleBinding: vi.fn().mockResolvedValue({ items: [] }),
        listRoleBindingForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
      policyApi: {
        listPodDisruptionBudgetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
      networkingApi: {
        listNetworkPolicyForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
    } as unknown as KubernetesClient;

    const runner = new AiConformanceRunner({
      kubernetes: brokenK8s,
      storage: repo,
    });

    const record = await runner.run({
      selection: {
        options: { kubernetesMinorOverride: '1.31' },
      },
    });

    expect(record.state).toBe('partial');
    const results = repo.getRequirementResultsForRun(record.run_id);
    expect(results.some((r) => r.status === 'not-evaluated')).toBe(true);
  });
});
