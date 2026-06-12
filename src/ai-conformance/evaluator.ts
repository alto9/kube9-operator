/**
 * Kubernetes AI Conformance requirement evaluator.
 *
 * Maps checklist requirement IDs to observable Kubernetes API signals.
 * Requirements without objective signals are marked not-evaluated or needs-evidence.
 */

import * as k8s from '@kubernetes/client-node';
import type { KubernetesClient } from '../kubernetes/client.js';
import type { Logger } from 'winston';
import type { AiConformanceChecklistRequirement } from './checklist/contracts.js';
import {
  boundConformanceText,
  EvaluatedRequirementResultSchema,
  type AiConformanceRequirementStatus,
  type EvaluatedRequirementResult,
} from './contracts.js';

export interface AiConformanceEvaluatorContext {
  kubernetes: KubernetesClient;
  logger?: Logger;
}

export type RequirementEvaluator = (
  requirement: AiConformanceChecklistRequirement,
  ctx: AiConformanceEvaluatorContext
) => Promise<EvaluatedRequirementResult>;

const SYSTEM_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'kube9-system',
]);

function hasWildcard(arr: string[] | undefined): boolean {
  if (!arr || !Array.isArray(arr)) {
    return false;
  }
  return arr.some((v) => v === '*');
}

function result(
  requirement: AiConformanceChecklistRequirement,
  status: AiConformanceRequirementStatus,
  rationale: string,
  evidenceRef?: string | null,
  evaluatedAt?: string
): EvaluatedRequirementResult {
  return EvaluatedRequirementResultSchema.parse({
    requirement_id: requirement.id,
    category: requirement.category,
    level: requirement.level,
    title: requirement.title,
    status,
    rationale: boundConformanceText(rationale),
    evidence_ref: evidenceRef ?? null,
    evaluated_at: evaluatedAt ?? new Date().toISOString(),
  });
}

async function evaluateRbacLeastPrivilege(
  requirement: AiConformanceChecklistRequirement,
  ctx: AiConformanceEvaluatorContext
): Promise<EvaluatedRequirementResult> {
  try {
    const [clusterRoleList, roleList, crbList, rbList] = await Promise.all([
      ctx.kubernetes.rbacApi.listClusterRole(),
      ctx.kubernetes.rbacApi.listRoleForAllNamespaces(),
      ctx.kubernetes.rbacApi.listClusterRoleBinding(),
      ctx.kubernetes.rbacApi.listRoleBindingForAllNamespaces(),
    ]);

    const wildcardViolations: string[] = [];
    for (const cr of clusterRoleList?.items ?? []) {
      const name = cr.metadata?.name ?? 'unknown';
      for (const rule of cr.rules ?? []) {
        if (
          hasWildcard(rule.resources) ||
          hasWildcard(rule.verbs) ||
          hasWildcard(rule.apiGroups)
        ) {
          wildcardViolations.push(`ClusterRole/${name}`);
          break;
        }
      }
    }
    for (const r of roleList?.items ?? []) {
      const name = r.metadata?.name ?? 'unknown';
      const namespace = r.metadata?.namespace ?? '';
      for (const rule of r.rules ?? []) {
        if (
          hasWildcard(rule.resources) ||
          hasWildcard(rule.verbs) ||
          hasWildcard(rule.apiGroups)
        ) {
          wildcardViolations.push(`Role/${namespace}/${name}`);
          break;
        }
      }
    }

    const adminViolations: string[] = [];
    for (const crb of crbList?.items ?? []) {
      if (crb.roleRef?.name !== 'cluster-admin' || crb.roleRef?.kind !== 'ClusterRole') {
        continue;
      }
      const name = crb.metadata?.name ?? 'unknown';
      const subjects = crb.subjects ?? [];
      const allSystem =
        subjects.length > 0 &&
        subjects.every(
          (s) =>
            s.kind === 'ServiceAccount' &&
            s.namespace !== undefined &&
            SYSTEM_NAMESPACES.has(s.namespace)
        );
      if (subjects.length === 0 || !allSystem) {
        adminViolations.push(`ClusterRoleBinding/${name}`);
      }
    }
    for (const rb of rbList?.items ?? []) {
      if (rb.roleRef?.name !== 'cluster-admin' || rb.roleRef?.kind !== 'ClusterRole') {
        continue;
      }
      const namespace = rb.metadata?.namespace ?? '';
      if (!SYSTEM_NAMESPACES.has(namespace)) {
        adminViolations.push(`RoleBinding/${namespace}/${rb.metadata?.name ?? 'unknown'}`);
      }
    }

    const issues = [...wildcardViolations, ...adminViolations];
    if (issues.length === 0) {
      return result(
        requirement,
        'passed',
        'No wildcard RBAC rules or cluster-admin misuse detected in observable roles and bindings.',
        'k8s.rbac.authorization/v1'
      );
    }

    const summary =
      issues.length <= 3
        ? issues.join(', ')
        : `${issues.length} RBAC issue(s): ${issues.slice(0, 2).join(', ')}...`;

    return result(
      requirement,
      'failed',
      `Least-privilege violations found: ${summary}`,
      'k8s.rbac.authorization/v1'
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger?.error?.('RBAC least-privilege evaluation failed', { error: msg });
    return result(
      requirement,
      'not-evaluated',
      `Could not list RBAC resources: ${boundConformanceText(msg, 200)}`,
      null
    );
  }
}

function isDefaultDenyPolicy(np: k8s.V1NetworkPolicy): boolean {
  const selector = np.spec?.podSelector;
  const hasEmptySelector =
    selector !== undefined &&
    (selector.matchLabels === undefined || Object.keys(selector.matchLabels).length === 0) &&
    (selector.matchExpressions === undefined || selector.matchExpressions.length === 0);
  const policyTypes = np.spec?.policyTypes ?? [];
  return hasEmptySelector && policyTypes.includes('Ingress') && policyTypes.includes('Egress');
}

async function evaluateNetworkPolicyDefaultDeny(
  requirement: AiConformanceChecklistRequirement,
  ctx: AiConformanceEvaluatorContext
): Promise<EvaluatedRequirementResult> {
  try {
    const [deploymentsRes, networkPoliciesRes] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.networkingApi.listNetworkPolicyForAllNamespaces(),
    ]);

    const workloadNamespaces = new Set<string>();
    for (const d of deploymentsRes.items ?? []) {
      const ns = d.metadata?.namespace ?? '';
      if (ns && !SYSTEM_NAMESPACES.has(ns)) {
        workloadNamespaces.add(ns);
      }
    }

    if (workloadNamespaces.size === 0) {
      return result(
        requirement,
        'not-applicable',
        'No user workload namespaces with Deployments were found to evaluate default-deny network policies.',
        'k8s.apps/v1'
      );
    }

    const defaultDenyNamespaces = new Set<string>();
    for (const np of networkPoliciesRes.items ?? []) {
      const ns = np.metadata?.namespace ?? '';
      if (ns && isDefaultDenyPolicy(np)) {
        defaultDenyNamespaces.add(ns);
      }
    }

    const uncovered = [...workloadNamespaces].filter((ns) => !defaultDenyNamespaces.has(ns));
    if (uncovered.length === 0) {
      return result(
        requirement,
        'passed',
        'All workload namespaces have a default-deny NetworkPolicy (empty podSelector with Ingress and Egress policy types).',
        'k8s.networking/v1'
      );
    }
    if (uncovered.length === workloadNamespaces.size) {
      const sample = uncovered.slice(0, 3).join(', ');
      return result(
        requirement,
        'failed',
        `No default-deny NetworkPolicy found in workload namespaces: ${sample}${uncovered.length > 3 ? '...' : ''}`,
        'k8s.networking/v1'
      );
    }

    const sample = uncovered.slice(0, 3).join(', ');
    return result(
      requirement,
      'warning',
      `${uncovered.length} of ${workloadNamespaces.size} workload namespace(s) lack default-deny NetworkPolicy: ${sample}${uncovered.length > 3 ? '...' : ''}`,
      'k8s.networking/v1'
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger?.error?.('Network policy evaluation failed', { error: msg });
    return result(
      requirement,
      'not-evaluated',
      `Could not list NetworkPolicies or Deployments: ${boundConformanceText(msg, 200)}`,
      null
    );
  }
}

function evaluateSecretsEncryptionAtRest(
  requirement: AiConformanceChecklistRequirement
): EvaluatedRequirementResult {
  return result(
    requirement,
    'needs-evidence',
    'etcd secrets encryption configuration is not observable through the Kubernetes API from the operator. Provide encryption-at-rest configuration evidence per organizational policy.',
    'external:etcd-encryption-config'
  );
}

function pdbCoversWorkload(
  pdb: k8s.V1PodDisruptionBudget,
  namespace: string,
  podLabels: Record<string, string> | undefined
): boolean {
  if ((pdb.metadata?.namespace ?? '') !== namespace) {
    return false;
  }
  const matchLabels = pdb.spec?.selector?.matchLabels ?? {};
  const workloadLabels = podLabels ?? {};
  if (Object.keys(matchLabels).length === 0) {
    return false;
  }
  for (const [k, v] of Object.entries(matchLabels)) {
    if (workloadLabels[k] !== v) {
      return false;
    }
  }
  return true;
}

async function evaluatePodDisruptionBudgets(
  requirement: AiConformanceChecklistRequirement,
  ctx: AiConformanceEvaluatorContext
): Promise<EvaluatedRequirementResult> {
  try {
    const [deploymentsRes, statefulSetsRes, pdbsRes] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
      ctx.kubernetes.policyApi.listPodDisruptionBudgetForAllNamespaces(),
    ]);

    const pdbs = pdbsRes.items ?? [];
    const violations: string[] = [];

    for (const d of deploymentsRes.items ?? []) {
      const ns = d.metadata?.namespace ?? '';
      const name = d.metadata?.name ?? 'unknown';
      const replicas = d.spec?.replicas ?? 1;
      if (replicas < 2) {
        continue;
      }
      const podLabels = d.spec?.template?.metadata?.labels as Record<string, string> | undefined;
      const covered = pdbs.some((p) => pdbCoversWorkload(p, ns, podLabels));
      if (!covered) {
        violations.push(`${ns}/${name}`);
      }
    }

    for (const s of statefulSetsRes.items ?? []) {
      const ns = s.metadata?.namespace ?? '';
      const name = s.metadata?.name ?? 'unknown';
      const replicas = s.spec?.replicas ?? 1;
      if (replicas < 2) {
        continue;
      }
      const podLabels = s.spec?.template?.metadata?.labels as Record<string, string> | undefined;
      const covered = pdbs.some((p) => pdbCoversWorkload(p, ns, podLabels));
      if (!covered) {
        violations.push(`${ns}/${name}`);
      }
    }

    if (violations.length === 0) {
      return result(
        requirement,
        'passed',
        'All multi-replica Deployments and StatefulSets have matching PodDisruptionBudget coverage.',
        'k8s.policy/v1'
      );
    }

    const sample =
      violations.length <= 3
        ? violations.join(', ')
        : `${violations.length} workload(s): ${violations.slice(0, 2).join(', ')}...`;

    return result(
      requirement,
      'warning',
      `HA workloads without PodDisruptionBudget: ${sample}`,
      'k8s.policy/v1'
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger?.error?.('PDB evaluation failed', { error: msg });
    return result(
      requirement,
      'not-evaluated',
      `Could not list workloads or PodDisruptionBudgets: ${boundConformanceText(msg, 200)}`,
      null
    );
  }
}

function evaluateAuditLogging(
  requirement: AiConformanceChecklistRequirement
): EvaluatedRequirementResult {
  return result(
    requirement,
    'needs-evidence',
    'Cluster audit logging policy and retention are not observable through the Kubernetes API. Provide audit configuration evidence per organizational policy.',
    'external:kubernetes-audit-policy'
  );
}

const REQUIREMENT_EVALUATORS: Record<string, RequirementEvaluator> = {
  'security.rbac-least-privilege': evaluateRbacLeastPrivilege,
  'security.network-policy-default-deny': evaluateNetworkPolicyDefaultDeny,
  'security.secrets-encryption-at-rest': async (req) => evaluateSecretsEncryptionAtRest(req),
  'reliability.pod-disruption-budgets': evaluatePodDisruptionBudgets,
  'observability.audit-logging': async (req) => evaluateAuditLogging(req),
};

/**
 * Evaluate a single checklist requirement with exception isolation.
 */
export async function evaluateRequirement(
  requirement: AiConformanceChecklistRequirement,
  ctx: AiConformanceEvaluatorContext
): Promise<EvaluatedRequirementResult> {
  const handler = REQUIREMENT_EVALUATORS[requirement.id];
  if (!handler) {
    return result(
      requirement,
      'not-evaluated',
      `No evaluator registered for requirement ${requirement.id}.`,
      null
    );
  }

  try {
    return await handler(requirement, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger?.error?.('Requirement evaluation failed', {
      requirementId: requirement.id,
      error: msg,
    });
    return result(
      requirement,
      'not-evaluated',
      `Evaluator error: ${boundConformanceText(msg, 200)}`,
      null
    );
  }
}

/**
 * Evaluate all requirements in a checklist.
 */
export async function evaluateChecklistRequirements(
  requirements: AiConformanceChecklistRequirement[],
  ctx: AiConformanceEvaluatorContext
): Promise<EvaluatedRequirementResult[]> {
  const results: EvaluatedRequirementResult[] = [];
  for (const requirement of requirements) {
    results.push(await evaluateRequirement(requirement, ctx));
  }
  return results;
}
