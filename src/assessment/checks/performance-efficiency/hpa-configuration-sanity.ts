import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'performance-efficiency.hpa-configuration-sanity';
const CHECK_NAME = 'HPA Configuration Sanity';
const REMEDIATION =
  'Ensure each HPA targets an existing Deployment/StatefulSet, defines metrics, uses valid min/max bounds, and configures valid behavior policies when behavior is set.';

const EXCLUDED_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'tigera-operator',
  'calico-system',
]);

type WorkloadKey = `${string}/${string}/${string}`;

function workloadKey(namespace: string, kind: string, name: string): WorkloadKey {
  return `${namespace}/${kind}/${name}`;
}

function isInScopeNamespace(namespace: string | undefined): namespace is string {
  return typeof namespace === 'string' && namespace.length > 0 && !EXCLUDED_NAMESPACES.has(namespace);
}

function collectScalableWorkloads(
  deployments: k8s.V1Deployment[],
  statefulSets: k8s.V1StatefulSet[],
): Set<WorkloadKey> {
  const workloads = new Set<WorkloadKey>();

  for (const d of deployments) {
    const ns = d.metadata?.namespace;
    const name = d.metadata?.name;
    if (!isInScopeNamespace(ns) || !name) continue;
    workloads.add(workloadKey(ns, 'Deployment', name));
  }

  for (const s of statefulSets) {
    const ns = s.metadata?.namespace;
    const name = s.metadata?.name;
    if (!isInScopeNamespace(ns) || !name) continue;
    workloads.add(workloadKey(ns, 'StatefulSet', name));
  }

  return workloads;
}

function behaviorPolicyValid(policy: k8s.V2HPAScalingPolicy): boolean {
  return typeof policy.value === 'number' && policy.value > 0 && typeof policy.periodSeconds === 'number' && policy.periodSeconds > 0;
}

function validateBehavior(hpa: k8s.V2HorizontalPodAutoscaler): string[] {
  const violations: string[] = [];
  const scaleUpPolicies = hpa.spec?.behavior?.scaleUp?.policies ?? [];
  const scaleDownPolicies = hpa.spec?.behavior?.scaleDown?.policies ?? [];

  for (const p of scaleUpPolicies) {
    if (!behaviorPolicyValid(p)) {
      violations.push('scaleUp behavior policy has non-positive value/periodSeconds');
      break;
    }
  }

  for (const p of scaleDownPolicies) {
    if (!behaviorPolicyValid(p)) {
      violations.push('scaleDown behavior policy has non-positive value/periodSeconds');
      break;
    }
  }

  return violations;
}

export const hpaConfigurationSanityCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.PerformanceEfficiency,
  description:
    'Validates HPA targets, metrics, min/max bounds, and behavior policy sanity; warns when autoscaling coverage is limited.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [hpaRes, deploymentsRes, statefulSetsRes] = await Promise.all([
      ctx.kubernetes.autoscalingApi.listHorizontalPodAutoscalerForAllNamespaces(),
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
    ]);

    const hpas = hpaRes.items ?? [];
    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];
    const workloads = collectScalableWorkloads(deployments, statefulSets);

    if (hpas.length === 0) {
      if (workloads.size === 0) {
        return {
          checkId: CHECK_ID,
          checkName: CHECK_NAME,
          pillar: Pillar.PerformanceEfficiency,
          status: CheckStatus.Passing,
          severity: Severity.Medium,
          message: 'No in-scope Deployment/StatefulSet workloads found; HPA coverage check not applicable.',
          remediation: REMEDIATION,
        };
      }

      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        message:
          'No HPAs detected for in-scope workloads. Add HPAs for latency-sensitive or variable-load services.',
        remediation: REMEDIATION,
      };
    }

    const invalid: string[] = [];
    const covered = new Set<WorkloadKey>();

    for (const hpa of hpas) {
      const ns = hpa.metadata?.namespace ?? 'default';
      if (!isInScopeNamespace(ns)) continue;

      const hpaName = hpa.metadata?.name ?? 'unknown';
      const targetKind = hpa.spec?.scaleTargetRef?.kind;
      const targetName = hpa.spec?.scaleTargetRef?.name;
      const maxReplicas = hpa.spec?.maxReplicas;
      const minReplicas = hpa.spec?.minReplicas ?? 1;
      const metrics = hpa.spec?.metrics ?? [];

      if (!targetKind || !targetName) {
        invalid.push(`${ns}/${hpaName}: missing scaleTargetRef kind/name`);
        continue;
      }

      if (targetKind !== 'Deployment' && targetKind !== 'StatefulSet') {
        invalid.push(`${ns}/${hpaName}: unsupported scaleTargetRef kind '${targetKind}'`);
        continue;
      }

      const targetKey = workloadKey(ns, targetKind, targetName);
      if (!workloads.has(targetKey)) {
        invalid.push(`${ns}/${hpaName}: target ${targetKind}/${targetName} not found`);
      } else {
        covered.add(targetKey);
      }

      if (typeof maxReplicas !== 'number' || maxReplicas < 1) {
        invalid.push(`${ns}/${hpaName}: maxReplicas must be >= 1`);
      }

      if (minReplicas < 1) {
        invalid.push(`${ns}/${hpaName}: minReplicas must be >= 1`);
      }

      if (typeof maxReplicas === 'number' && minReplicas > maxReplicas) {
        invalid.push(`${ns}/${hpaName}: minReplicas (${minReplicas}) cannot exceed maxReplicas (${maxReplicas})`);
      }

      if (metrics.length === 0) {
        invalid.push(`${ns}/${hpaName}: metrics not configured`);
      }

      const behaviorViolations = validateBehavior(hpa);
      for (const issue of behaviorViolations) {
        invalid.push(`${ns}/${hpaName}: ${issue}`);
      }
    }

    if (invalid.length > 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Failing,
        severity: Severity.High,
        message:
          invalid.length <= 5
            ? `HPA misconfigurations detected: ${invalid.join('; ')}`
            : `${invalid.length} HPA misconfigurations detected: ${invalid.slice(0, 3).join('; ')}...`,
        remediation: REMEDIATION,
      };
    }

    const coverageRatio = workloads.size === 0 ? 1 : covered.size / workloads.size;
    if (workloads.size > 0 && coverageRatio < 0.5) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        message: `HPA configs are valid, but coverage is low: ${covered.size}/${workloads.size} in-scope workloads have HPA targets.`,
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.PerformanceEfficiency,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message: `HPA configs are sane. Coverage: ${covered.size}/${workloads.size} in-scope workloads targeted.`,
      remediation: REMEDIATION,
    };
  },
};
