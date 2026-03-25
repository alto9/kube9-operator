import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isNamespaceExcluded } from '../reliability/heuristics.js';

const CHECK_ID = 'performance-efficiency.node-affinity-and-placement';
const CHECK_NAME = 'Node Affinity and Placement';
const REMEDIATION =
  'For multi-replica services, add podAntiAffinity and/or topologySpreadConstraints, and avoid restrictive node pinning unless required by workload constraints.';

interface WorkloadRef {
  namespace: string;
  name: string;
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet';
}

interface Finding {
  status: CheckStatus.Failing | CheckStatus.Warning;
  severity: Severity.High | Severity.Medium;
  workload: WorkloadRef;
  message: string;
}

interface NodeProjection {
  name: string;
  labels: Record<string, string>;
}

function isInScopeNamespace(namespace: string | undefined): namespace is string {
  return typeof namespace === 'string' && namespace.length > 0 && !isNamespaceExcluded(namespace);
}

function getReplicas(kind: WorkloadRef['kind'], rawReplicas?: number): number {
  if (kind === 'DaemonSet') {
    return typeof rawReplicas === 'number' && rawReplicas > 0 ? rawReplicas : 1;
  }
  if (typeof rawReplicas === 'number' && rawReplicas >= 0) {
    return rawReplicas;
  }
  return 1;
}

function hasSpreadProtection(podSpec: k8s.V1PodSpec | undefined): boolean {
  if (!podSpec) return false;
  const antiAffinity = podSpec.affinity?.podAntiAffinity;
  const hasAntiAffinity =
    (antiAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.length ?? 0) > 0 ||
    (antiAffinity?.preferredDuringSchedulingIgnoredDuringExecution?.length ?? 0) > 0;
  const hasTopologySpread = (podSpec.topologySpreadConstraints?.length ?? 0) > 0;
  return hasAntiAffinity || hasTopologySpread;
}

function expressionMatchesNode(
  expr: k8s.V1NodeSelectorRequirement,
  labels: Record<string, string>,
  nodeName: string,
): boolean {
  const values = expr.values ?? [];
  const labelValue = expr.key === 'metadata.name' ? nodeName : labels[expr.key];
  switch (expr.operator) {
    case 'In':
      return labelValue !== undefined && values.includes(labelValue);
    case 'NotIn':
      return labelValue === undefined || !values.includes(labelValue);
    case 'Exists':
      return labelValue !== undefined;
    case 'DoesNotExist':
      return labelValue === undefined;
    case 'Gt': {
      const target = Number(values[0]);
      const actual = Number(labelValue);
      return Number.isFinite(target) && Number.isFinite(actual) && actual > target;
    }
    case 'Lt': {
      const target = Number(values[0]);
      const actual = Number(labelValue);
      return Number.isFinite(target) && Number.isFinite(actual) && actual < target;
    }
    default:
      return false;
  }
}

function termMatchesNode(term: k8s.V1NodeSelectorTerm, node: NodeProjection): boolean {
  const exprs = term.matchExpressions ?? [];
  const fields = term.matchFields ?? [];
  if (exprs.length === 0 && fields.length === 0) return false;
  return (
    exprs.every((expr) => expressionMatchesNode(expr, node.labels, node.name)) &&
    fields.every((expr) => expressionMatchesNode(expr, node.labels, node.name))
  );
}

function nodeMatchesPodPlacement(podSpec: k8s.V1PodSpec, node: NodeProjection): boolean {
  if (podSpec.nodeName && podSpec.nodeName !== node.name) {
    return false;
  }

  for (const [key, value] of Object.entries(podSpec.nodeSelector ?? {})) {
    if (node.labels[key] !== value) {
      return false;
    }
  }

  const required = podSpec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution;
  if (!required) {
    return true;
  }

  const terms = required.nodeSelectorTerms ?? [];
  if (terms.length === 0) {
    return false;
  }

  return terms.some((term) => termMatchesNode(term, node));
}

function evaluateWorkloadPlacement(
  workload: WorkloadRef,
  replicas: number,
  podSpec: k8s.V1PodSpec | undefined,
  nodes: NodeProjection[],
): Finding[] {
  const findings: Finding[] = [];
  if (!podSpec) return findings;

  if (replicas >= 2 && !hasSpreadProtection(podSpec)) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      workload,
      message:
        `${workload.namespace}/${workload.name} (${workload.kind}) has ${replicas} replicas ` +
        'without podAntiAffinity or topologySpreadConstraints; this risks pod concentration.',
    });
  }

  if (podSpec.nodeName) {
    findings.push({
      status: CheckStatus.Failing,
      severity: Severity.High,
      workload,
      message:
        `${workload.namespace}/${workload.name} (${workload.kind}) is pinned to node ` +
        `'${podSpec.nodeName}' via spec.nodeName; this bypasses scheduler placement controls.`,
    });
    return findings;
  }

  if (Object.keys(podSpec.nodeSelector ?? {}).length === 0 && !podSpec.affinity?.nodeAffinity) {
    return findings;
  }

  const matchedNodes = nodes.filter((n) => nodeMatchesPodPlacement(podSpec, n));

  if (matchedNodes.length === 0) {
    findings.push({
      status: CheckStatus.Failing,
      severity: Severity.High,
      workload,
      message:
        `${workload.namespace}/${workload.name} (${workload.kind}) has node placement constraints ` +
        'that match zero nodes; pods may remain unschedulable.',
    });
    return findings;
  }

  if (replicas >= 2 && matchedNodes.length === 1) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      workload,
      message:
        `${workload.namespace}/${workload.name} (${workload.kind}) has hard placement constraints ` +
        `matching only one node (${matchedNodes[0]?.name}); resilience and scheduling headroom are limited.`,
    });
  }

  return findings;
}

export const nodeAffinityAndPlacementCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.PerformanceEfficiency,
  description:
    'Evaluates workload pod placement strategy for anti-affinity/spread coverage and restrictive node placement constraints.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [deploymentsRes, statefulSetsRes, daemonSetsRes, nodeRes] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
      ctx.kubernetes.appsApi.listDaemonSetForAllNamespaces(),
      ctx.kubernetes.coreApi.listNode(),
    ]);

    const nodes: NodeProjection[] = (nodeRes.items ?? []).map((n) => ({
      name: n.metadata?.name ?? 'unknown',
      labels: n.metadata?.labels ?? {},
    }));

    if (nodes.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Warning,
        severity: Severity.Low,
        message: 'No nodes discovered from the API; node placement constraints could not be validated.',
        remediation: REMEDIATION,
      };
    }

    const findings: Finding[] = [];

    for (const deployment of deploymentsRes.items ?? []) {
      const namespace = deployment.metadata?.namespace;
      const name = deployment.metadata?.name;
      if (!isInScopeNamespace(namespace) || !name) continue;
      const workload: WorkloadRef = { namespace, name, kind: 'Deployment' };
      findings.push(
        ...evaluateWorkloadPlacement(
          workload,
          getReplicas('Deployment', deployment.spec?.replicas),
          deployment.spec?.template?.spec,
          nodes,
        ),
      );
    }

    for (const statefulSet of statefulSetsRes.items ?? []) {
      const namespace = statefulSet.metadata?.namespace;
      const name = statefulSet.metadata?.name;
      if (!isInScopeNamespace(namespace) || !name) continue;
      const workload: WorkloadRef = { namespace, name, kind: 'StatefulSet' };
      findings.push(
        ...evaluateWorkloadPlacement(
          workload,
          getReplicas('StatefulSet', statefulSet.spec?.replicas),
          statefulSet.spec?.template?.spec,
          nodes,
        ),
      );
    }

    for (const daemonSet of daemonSetsRes.items ?? []) {
      const namespace = daemonSet.metadata?.namespace;
      const name = daemonSet.metadata?.name;
      if (!isInScopeNamespace(namespace) || !name) continue;
      const workload: WorkloadRef = { namespace, name, kind: 'DaemonSet' };
      findings.push(
        ...evaluateWorkloadPlacement(
          workload,
          getReplicas('DaemonSet', daemonSet.status?.desiredNumberScheduled),
          daemonSet.spec?.template?.spec,
          nodes,
        ),
      );
    }

    if (findings.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: 'Placement constraints look healthy: no risky pinning, unschedulable selectors, or missing HA spread signals detected.',
        remediation: REMEDIATION,
      };
    }

    const failing = findings.filter((f) => f.status === CheckStatus.Failing);
    const warnings = findings.filter((f) => f.status === CheckStatus.Warning);
    const status = failing.length > 0 ? CheckStatus.Failing : CheckStatus.Warning;
    const severity = failing.length > 0 ? Severity.High : Severity.Medium;
    const sample = findings
      .slice(0, 4)
      .map((f) => f.message)
      .join('; ');
    const truncated = findings.length > 4 ? `; ... and ${findings.length - 4} more` : '';
    const first = findings[0];

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.PerformanceEfficiency,
      status,
      severity,
      message:
        `Placement findings: ${failing.length} failing, ${warnings.length} warning. ` +
        `${sample}${truncated}`,
      objectKind: first?.workload.kind,
      objectNamespace: first?.workload.namespace,
      objectName: first?.workload.name,
      remediation: REMEDIATION,
    };
  },
};
