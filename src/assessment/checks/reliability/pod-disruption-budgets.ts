/**
 * Reliability Check: PodDisruptionBudgets
 *
 * Surfaces workloads that lack PDB coverage when minAvailable/maxUnavailable
 * would be expected for HA services (replicas >= 2).
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isHaRelevant, type WorkloadMetadata } from './heuristics.js';

const CHECK_ID = 'reliability.pod-disruption-budgets';
const CHECK_NAME = 'PodDisruptionBudget Coverage';
const REMEDIATION =
  'Create a PodDisruptionBudget with minAvailable or maxUnavailable for HA workloads';

function getReplicas(
  spec: k8s.V1DeploymentSpec | k8s.V1StatefulSetSpec | undefined
): number {
  const raw = spec?.replicas;
  if (typeof raw === 'number' && raw >= 0) {
    return raw;
  }
  return 1;
}

/**
 * Check if a PDB covers a workload. A PDB covers a workload if its selector
 * matches the workload's pod template labels (subset match).
 */
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
  for (const [k, v] of Object.entries(matchLabels)) {
    if (workloadLabels[k] !== v) {
      return false;
    }
  }
  return Object.keys(matchLabels).length > 0;
}

function toWorkloadMeta(
  meta: k8s.V1ObjectMeta | undefined,
  kind: string
): WorkloadMetadata {
  return {
    namespace: meta?.namespace ?? '',
    name: meta?.name ?? 'unknown',
    kind,
    labels: meta?.labels as Record<string, string> | undefined,
  };
}

export const podDisruptionBudgetsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description: 'Surfaces HA workloads that lack PodDisruptionBudget coverage',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [deploymentsRes, statefulSetsRes, pdbsRes] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
      ctx.kubernetes.policyApi.listPodDisruptionBudgetForAllNamespaces(),
    ]);

    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];
    const pdbs = pdbsRes.items ?? [];

    const violations: string[] = [];

    for (const d of deployments) {
      const meta = toWorkloadMeta(d.metadata, 'Deployment');
      if (!isHaRelevant(meta)) continue;

      const replicas = getReplicas(d.spec);
      if (replicas < 2) continue;

      const podLabels = d.spec?.template?.metadata?.labels as Record<string, string> | undefined;
      const covered = pdbs.some((p) =>
        pdbCoversWorkload(p, meta.namespace, podLabels)
      );

      if (!covered) {
        violations.push(`${meta.namespace}/${meta.name} (Deployment)`);
      }
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isHaRelevant(meta)) continue;

      const replicas = getReplicas(s.spec);
      if (replicas < 2) continue;

      const podLabels = s.spec?.template?.metadata?.labels as Record<string, string> | undefined;
      const covered = pdbs.some((p) =>
        pdbCoversWorkload(p, meta.namespace, podLabels)
      );

      if (!covered) {
        violations.push(`${meta.namespace}/${meta.name} (StatefulSet)`);
      }
    }

    if (violations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Reliability,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: 'All multi-replica HA workloads have PDB coverage',
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `HA workloads without PDB: ${violations.join(', ')}`
        : `${violations.length} HA workloads without PDB: ${violations.slice(0, 3).join(', ')}...`;

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Reliability,
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      objectKind: 'Deployment',
      message,
      remediation: REMEDIATION,
    };
  },
};
