import { describe, it, expect, vi } from 'vitest';
import { rbacClusterAdminMisuseCheck } from './rbac-cluster-admin-misuse.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockContext(overrides: Partial<{
  listClusterRoleBinding: () => Promise<unknown>;
  listRoleBindingForAllNamespaces: () => Promise<unknown>;
}> = {}): AssessmentRunContext {
  return {
    kubernetes: {
      rbacApi: {
        listClusterRoleBinding: overrides.listClusterRoleBinding ?? (async () => ({ items: [] })),
        listRoleBindingForAllNamespaces:
          overrides.listRoleBindingForAllNamespaces ?? (async () => ({ items: [] })),
      },
    } as never,
    config: {} as never,
    timeoutMs: 30000,
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    runId: 'test-run',
    mode: 'full' as never,
  };
}

describe('rbac-cluster-admin-misuse', () => {
  it('returns passing when no cluster-admin misuse', async () => {
    const ctx = createMockContext();
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.checkId).toBe('security.rbac-cluster-admin-misuse');
    expect(result.pillar).toBe(Pillar.Security);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('No cluster-admin misuse');
  });

  it('returns passing when ClusterRoleBinding has system ServiceAccount', async () => {
    const ctx = createMockContext({
      listClusterRoleBinding: async () => ({
        items: [
          {
            metadata: { name: 'system-binding' },
            roleRef: { name: 'cluster-admin', kind: 'ClusterRole' },
            subjects: [
              { kind: 'ServiceAccount', name: 'default', namespace: 'kube-system' },
            ],
          },
        ],
      }),
      listRoleBindingForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('returns failing when ClusterRoleBinding has non-system ServiceAccount', async () => {
    const ctx = createMockContext({
      listClusterRoleBinding: async () => ({
        items: [
          {
            metadata: { name: 'bad-crb' },
            roleRef: { name: 'cluster-admin', kind: 'ClusterRole' },
            subjects: [
              { kind: 'ServiceAccount', name: 'admin', namespace: 'default' },
            ],
          },
        ],
      }),
      listRoleBindingForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.objectKind).toBe('ClusterRoleBinding');
    expect(result.objectName).toBe('bad-crb');
    expect(result.message).toContain('cluster-admin');
  });

  it('returns failing when RoleBinding references cluster-admin in non-system namespace', async () => {
    const ctx = createMockContext({
      listClusterRoleBinding: async () => ({ items: [] }),
      listRoleBindingForAllNamespaces: async () => ({
        items: [
          {
            metadata: { name: 'dev-admin', namespace: 'default' },
            roleRef: { name: 'cluster-admin', kind: 'ClusterRole' },
            subjects: [{ kind: 'User', name: 'dev@example.com' }],
          },
        ],
      }),
    });
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.objectKind).toBe('RoleBinding');
    expect(result.objectNamespace).toBe('default');
    expect(result.objectName).toBe('dev-admin');
  });

  it('returns passing when RoleBinding references cluster-admin in kube-system', async () => {
    const ctx = createMockContext({
      listClusterRoleBinding: async () => ({ items: [] }),
      listRoleBindingForAllNamespaces: async () => ({
        items: [
          {
            metadata: { name: 'system-rb', namespace: 'kube-system' },
            roleRef: { name: 'cluster-admin', kind: 'ClusterRole' },
            subjects: [{ kind: 'ServiceAccount', name: 'default', namespace: 'kube-system' }],
          },
        ],
      }),
    });
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('returns failing when ClusterRoleBinding has User subject', async () => {
    const ctx = createMockContext({
      listClusterRoleBinding: async () => ({
        items: [
          {
            metadata: { name: 'user-admin' },
            roleRef: { name: 'cluster-admin', kind: 'ClusterRole' },
            subjects: [{ kind: 'User', name: 'admin@example.com' }],
          },
        ],
      }),
      listRoleBindingForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.objectName).toBe('user-admin');
  });

  it('returns error when API call fails', async () => {
    const ctx = createMockContext({
      listClusterRoleBinding: async () => {
        throw new Error('Forbidden');
      },
      listRoleBindingForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacClusterAdminMisuseCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Error);
    expect(result.message).toContain('Forbidden');
    expect(result.errorCode).toBe('RBAC_LIST_ERROR');
  });
});
