/**
 * RBAC Wildcard Permissions Check
 *
 * Detects overly permissive policies in ClusterRoles and Roles by identifying
 * wildcard (*) usage in resources, verbs, or apiGroups.
 */

import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'security.rbac-wildcard-permissions';
const CHECK_NAME = 'RBAC Wildcard Permissions';

function hasWildcard(arr: string[] | undefined): boolean {
  if (!arr || !Array.isArray(arr)) return false;
  return arr.some((v) => v === '*');
}

function checkRoleForWildcards(
  name: string,
  kind: string,
  namespace: string | undefined,
  rules: Array<{ resources?: string[]; verbs?: string[]; apiGroups?: string[] }> | undefined
): { hasWildcard: boolean; objectKind: string; objectNamespace: string; objectName: string } | null {
  if (!rules || !Array.isArray(rules)) return null;
  for (const rule of rules) {
    if (hasWildcard(rule.resources) || hasWildcard(rule.verbs) || hasWildcard(rule.apiGroups)) {
      return {
        hasWildcard: true,
        objectKind: kind,
        objectNamespace: namespace ?? '',
        objectName: name,
      };
    }
  }
  return null;
}

export const rbacWildcardPermissionsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Security,
  description: 'Detects wildcard permissions (*) in ClusterRoles and Roles that grant overly broad access',
  defaultSeverity: Severity.High,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const violations: Array<{ kind: string; namespace: string; name: string }> = [];

    try {
      const [clusterRoleList, roleList] = await Promise.all([
        ctx.kubernetes.rbacApi.listClusterRole(),
        ctx.kubernetes.rbacApi.listRoleForAllNamespaces(),
      ]);

      const clusterRoles = clusterRoleList?.items ?? [];
      const roles = roleList?.items ?? [];

      for (const cr of clusterRoles) {
        const name = cr.metadata?.name ?? 'unknown';
        const result = checkRoleForWildcards(name, 'ClusterRole', undefined, cr.rules);
        if (result?.hasWildcard) {
          violations.push({ kind: 'ClusterRole', namespace: '', name });
        }
      }

      for (const r of roles) {
        const name = r.metadata?.name ?? 'unknown';
        const namespace = r.metadata?.namespace ?? '';
        const result = checkRoleForWildcards(name, 'Role', namespace, r.rules);
        if (result?.hasWildcard) {
          violations.push({ kind: 'Role', namespace, name });
        }
      }

      if (violations.length === 0) {
        return {
          checkId: CHECK_ID,
          checkName: CHECK_NAME,
          pillar: Pillar.Security,
          status: CheckStatus.Passing,
          severity: Severity.High,
          message: 'No wildcard permissions found in ClusterRoles or Roles',
          remediation: 'Continue to avoid wildcard (*) in resources, verbs, or apiGroups.',
        };
      }

      const first = violations[0];
      const refs = violations
        .map((v) => (v.namespace ? `${v.kind}/${v.namespace}/${v.name}` : `${v.kind}/${v.name}`))
        .join(', ');

      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Security,
        status: CheckStatus.Failing,
        severity: Severity.High,
        objectKind: first.kind,
        objectNamespace: first.namespace || undefined,
        objectName: first.name,
        message: `Found ${violations.length} role(s) with wildcard permissions: ${refs}`,
        remediation:
          'Replace wildcard (*) in resources, verbs, or apiGroups with explicit least-privilege values.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger?.error?.('RBAC wildcard check failed', { error: msg });
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Security,
        status: CheckStatus.Error,
        message: `Failed to list RBAC resources: ${msg}`,
        errorCode: 'RBAC_LIST_ERROR',
      };
    }
  },
};
