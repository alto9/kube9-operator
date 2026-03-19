import { describe, it, expect, vi } from 'vitest';
import { rbacWildcardPermissionsCheck } from './rbac-wildcard-permissions.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockContext(overrides: Partial<{
  listClusterRole: () => Promise<unknown>;
  listRoleForAllNamespaces: () => Promise<unknown>;
}> = {}): AssessmentRunContext {
  return {
    kubernetes: {
      rbacApi: {
        listClusterRole: overrides.listClusterRole ?? (async () => ({ items: [] })),
        listRoleForAllNamespaces: overrides.listRoleForAllNamespaces ?? (async () => ({ items: [] })),
      },
    },
    config: {},
    timeoutMs: 30000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('rbac-wildcard-permissions', () => {
  it('returns passing when no wildcards found', async () => {
    const ctx = createMockContext();
    const result = await rbacWildcardPermissionsCheck.run(ctx);
    expect(result.checkId).toBe('security.rbac-wildcard-permissions');
    expect(result.pillar).toBe(Pillar.Security);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('No wildcard permissions');
  });

  it('returns failing when ClusterRole has wildcard in resources', async () => {
    const ctx = createMockContext({
      listClusterRole: async () => ({
        items: [
          {
            metadata: { name: 'admin-role' },
            rules: [{ resources: ['*'], verbs: ['get', 'list'] }],
          },
        ],
      }),
      listRoleForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacWildcardPermissionsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.objectKind).toBe('ClusterRole');
    expect(result.objectName).toBe('admin-role');
    expect(result.message).toContain('admin-role');
    expect(result.message).toContain('wildcard');
  });

  it('returns failing when Role has wildcard in verbs', async () => {
    const ctx = createMockContext({
      listClusterRole: async () => ({ items: [] }),
      listRoleForAllNamespaces: async () => ({
        items: [
          {
            metadata: { name: 'foo-role', namespace: 'default' },
            rules: [{ resources: ['pods'], verbs: ['*'] }],
          },
        ],
      }),
    });
    const result = await rbacWildcardPermissionsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.objectKind).toBe('Role');
    expect(result.objectNamespace).toBe('default');
    expect(result.objectName).toBe('foo-role');
  });

  it('returns failing when wildcard in apiGroups', async () => {
    const ctx = createMockContext({
      listClusterRole: async () => ({
        items: [
          {
            metadata: { name: 'wide-role' },
            rules: [{ apiGroups: ['*'], resources: ['pods'], verbs: ['get'] }],
          },
        ],
      }),
      listRoleForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacWildcardPermissionsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.objectName).toBe('wide-role');
  });

  it('returns error when API call fails', async () => {
    const ctx = createMockContext({
      listClusterRole: async () => {
        throw new Error('Forbidden');
      },
      listRoleForAllNamespaces: async () => ({ items: [] }),
    });
    const result = await rbacWildcardPermissionsCheck.run(ctx);
    expect(result.status).toBe(CheckStatus.Error);
    expect(result.message).toContain('Forbidden');
    expect(result.errorCode).toBe('RBAC_LIST_ERROR');
  });
});
