import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isNamespaceExcluded } from '../reliability/heuristics.js';

const CHECK_ID = 'cost-optimization.spot-instance-usage';
const CHECK_NAME = 'Spot/Preemptible Capacity Usage';
const REMEDIATION =
  'When spot/preemptible node pools exist, add workload scheduling intent with nodeSelector/nodeAffinity and matching tolerations so eligible workloads can land on lower-cost capacity.';

interface WorkloadRef {
  namespace: string;
  name: string;
  kind: 'Deployment' | 'StatefulSet';
}

const SPOT_LABEL_RULES: Array<{ key: string; values?: string[] }> = [
  { key: 'eks.amazonaws.com/capacityType', values: ['SPOT'] },
  { key: 'kubernetes.azure.com/scalesetpriority', values: ['spot'] },
  { key: 'cloud.google.com/gke-provisioning', values: ['spot'] },
  { key: 'cloud.google.com/gke-preemptible', values: ['true'] },
  { key: 'node.kubernetes.io/lifecycle', values: ['spot'] },
  { key: 'karpenter.sh/capacity-type', values: ['spot'] },
];

const SPOT_HINTS = ['spot', 'preempt', 'interruptible', 'lifecycle=spot'];

function isInScopeNamespace(namespace: string | undefined): namespace is string {
  return typeof namespace === 'string' && namespace.length > 0 && !isNamespaceExcluded(namespace);
}

function hasSpotLikeText(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return SPOT_HINTS.some((hint) => normalized.includes(hint));
}

function nodeLooksSpot(node: k8s.V1Node): boolean {
  const labels = node.metadata?.labels ?? {};
  for (const rule of SPOT_LABEL_RULES) {
    const value = labels[rule.key];
    if (value === undefined) continue;
    if (!rule.values || rule.values.some((allowed) => allowed.toLowerCase() === value.toLowerCase())) {
      return true;
    }
  }

  const taints = node.spec?.taints ?? [];
  return taints.some((taint) => hasSpotLikeText(taint.key) || hasSpotLikeText(taint.value));
}

function workloadTargetsSpot(podSpec: k8s.V1PodSpec | undefined): boolean {
  if (!podSpec) return false;

  for (const [key, value] of Object.entries(podSpec.nodeSelector ?? {})) {
    if (hasSpotLikeText(key) || hasSpotLikeText(value)) {
      return true;
    }
  }

  const requiredTerms =
    podSpec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms ?? [];
  for (const term of requiredTerms) {
    for (const expression of term.matchExpressions ?? []) {
      if (
        hasSpotLikeText(expression.key) ||
        (expression.values ?? []).some((value) => hasSpotLikeText(value))
      ) {
        return true;
      }
    }
  }

  const preferredTerms = podSpec.affinity?.nodeAffinity?.preferredDuringSchedulingIgnoredDuringExecution ?? [];
  for (const preferred of preferredTerms) {
    for (const expression of preferred.preference.matchExpressions ?? []) {
      if (
        hasSpotLikeText(expression.key) ||
        (expression.values ?? []).some((value) => hasSpotLikeText(value))
      ) {
        return true;
      }
    }
  }

  const tolerations = podSpec.tolerations ?? [];
  return tolerations.some(
    (tol) =>
      hasSpotLikeText(tol.key) || hasSpotLikeText(tol.value) || hasSpotLikeText(tol.operator),
  );
}

function getSpotLabelSummary(nodes: k8s.V1Node[]): string[] {
  const labels = new Set<string>();
  for (const node of nodes) {
    const nodeLabels = node.metadata?.labels ?? {};
    for (const rule of SPOT_LABEL_RULES) {
      if (nodeLabels[rule.key] !== undefined) {
        labels.add(rule.key);
      }
    }
  }
  return Array.from(labels).sort();
}

export const spotInstanceUsageCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.CostOptimization,
  description:
    'Detects whether clusters with spot/preemptible capacity have workload scheduling intent configured to use that lower-cost node pool.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [nodesRes, deploymentsRes, statefulSetsRes] = await Promise.all([
      ctx.kubernetes.coreApi.listNode(),
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
    ]);

    const nodes = nodesRes.items ?? [];
    const spotNodes = nodes.filter(nodeLooksSpot);
    if (spotNodes.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.CostOptimization,
        status: CheckStatus.Passing,
        severity: Severity.Low,
        message:
          'No spot/preemptible nodes detected from node labels or taints; spot capacity guidance is not applicable.',
        remediation: REMEDIATION,
      };
    }

    const targeted: WorkloadRef[] = [];
    const unconfigured: WorkloadRef[] = [];
    const inScopeWorkloads: WorkloadRef[] = [];

    for (const deployment of deploymentsRes.items ?? []) {
      const namespace = deployment.metadata?.namespace;
      const name = deployment.metadata?.name;
      if (!isInScopeNamespace(namespace) || !name) continue;
      const workload: WorkloadRef = { namespace, name, kind: 'Deployment' };
      inScopeWorkloads.push(workload);
      if (workloadTargetsSpot(deployment.spec?.template?.spec)) targeted.push(workload);
      else unconfigured.push(workload);
    }

    for (const statefulSet of statefulSetsRes.items ?? []) {
      const namespace = statefulSet.metadata?.namespace;
      const name = statefulSet.metadata?.name;
      if (!isInScopeNamespace(namespace) || !name) continue;
      const workload: WorkloadRef = { namespace, name, kind: 'StatefulSet' };
      inScopeWorkloads.push(workload);
      if (workloadTargetsSpot(statefulSet.spec?.template?.spec)) targeted.push(workload);
      else unconfigured.push(workload);
    }

    const firstUnconfigured = unconfigured[0];
    const spotSignals = getSpotLabelSummary(spotNodes);

    if (inScopeWorkloads.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.CostOptimization,
        status: CheckStatus.Passing,
        severity: Severity.Low,
        message:
          'Spot/preemptible nodes were detected, but no in-scope Deployment/StatefulSet workloads were found.',
        remediation: REMEDIATION,
      };
    }

    if (targeted.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.CostOptimization,
        status: CheckStatus.Failing,
        severity: Severity.High,
        objectKind: firstUnconfigured?.kind,
        objectNamespace: firstUnconfigured?.namespace,
        objectName: firstUnconfigured?.name,
        message:
          `Spot/preemptible capacity is available (${spotNodes.length}/${nodes.length} nodes), ` +
          `but none of ${inScopeWorkloads.length} in-scope workloads express spot scheduling intent. ` +
          `Detected spot signals: ${spotSignals.join(', ') || 'taints only'}.`,
        remediation: REMEDIATION,
      };
    }

    if (unconfigured.length > 0) {
      const sample = unconfigured
        .slice(0, 3)
        .map((w) => `${w.namespace}/${w.name}`)
        .join(', ');
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.CostOptimization,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        objectKind: firstUnconfigured?.kind,
        objectNamespace: firstUnconfigured?.namespace,
        objectName: firstUnconfigured?.name,
        message:
          `Spot/preemptible capacity is available and used by ${targeted.length}/${inScopeWorkloads.length} ` +
          `in-scope workloads, but ${unconfigured.length} workloads do not appear spot-aware (for example: ${sample}).`,
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.CostOptimization,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message:
        `Spot/preemptible capacity is available (${spotNodes.length}/${nodes.length} nodes) and all ` +
        `${inScopeWorkloads.length} in-scope workloads express spot scheduling intent.`,
      remediation: REMEDIATION,
    };
  },
};
