/**
 * RBAC Cluster-Admin Misuse Check
 *
 * Detects bindings to the cluster-admin ClusterRole outside system namespaces.
 * System namespaces: kube-system, kube-public, kube-node-lease, kube9-system.
 */

import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'security.rbac-cluster-admin-misuse';
const CHECK_NAME = 'RBAC Cluster-Admin Misuse';

const SYSTEM_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'kube9-system',
]);

function isClusterAdminBinding(roleRef: { name?: string; kind?: string } | undefined): boolean {
  return roleRef?.name === 'cluster-admin' && roleRef?.kind === 'ClusterRole';
}

function isSystemSubject(
  subject: { kind?: string; namespace?: string } | undefined
): boolean {
  if (!subject) return false;
  if (subject.kind === 'ServiceAccount' && subject.namespace) {
    return SYSTEM_NAMESPACES.has(subject.namespace);
  }
  return false;
}

export const rbacClusterAdminMisuseCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Security,
  description: 'Detects cluster-admin ClusterRole bound outside system namespaces',
  defaultSeverity: Severity.Critical,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const violations: Array<{ kind: string; namespace: string; name: string }> = [];

    try {
      const [crbList, rbList] = await Promise.all([
        ctx.kubernetes.rbacApi.listClusterRoleBinding(),
        ctx.kubernetes.rbacApi.listRoleBindingForAllNamespaces(),
      ]);

      const clusterRoleBindings = crbList?.items ?? [];
      const roleBindings = rbList?.items ?? [];

      for (const crb of clusterRoleBindings) {
        if (!isClusterAdminBinding(crb.roleRef)) continue;
        const name = crb.metadata?.name ?? 'unknown';
        const subjects = crb.subjects ?? [];
        const allSystem = subjects.length > 0 && subjects.every(isSystemSubject);
        if (subjects.length === 0 || !allSystem) {
          violations.push({ kind: 'ClusterRoleBinding', namespace: '', name });
        }
      }

      for (const rb of roleBindings) {
        if (!isClusterAdminBinding(rb.roleRef)) continue;
        const namespace = rb.metadata?.namespace ?? '';
        if (!SYSTEM_NAMESPACES.has(namespace)) {
          const name = rb.metadata?.name ?? 'unknown';
          violations.push({ kind: 'RoleBinding', namespace, name });
        }
      }

      if (violations.length === 0) {
        return {
          checkId: CHECK_ID,
          checkName: CHECK_NAME,
          pillar: Pillar.Security,
          status: CheckStatus.Passing,
          severity: Severity.Critical,
          message: 'No cluster-admin misuse detected',
          remediation: 'Ensure cluster-admin is only bound in system namespaces.',
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
        severity: Severity.Critical,
        objectKind: first.kind,
        objectNamespace: first.namespace || undefined,
        objectName: first.name,
        message: `Found ${violations.length} binding(s) to cluster-admin outside system namespaces: ${refs}`,
        remediation:
          'Restrict cluster-admin to system namespaces (kube-system, kube-public, kube-node-lease, kube9-system) or use least-privilege roles.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger?.error?.('RBAC cluster-admin check failed', { error: msg });
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Security,
        status: CheckStatus.Error,
        message: `Failed to list RBAC bindings: ${msg}`,
        errorCode: 'RBAC_LIST_ERROR',
      };
    }
  },
};
