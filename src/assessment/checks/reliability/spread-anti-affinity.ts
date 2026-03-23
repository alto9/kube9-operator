/**
 * Reliability Check: Spread / Anti-Affinity
 *
 * Validates that HA workloads (replicas >= 2) have pod anti-affinity or
 * topology spread constraints to avoid single-point-of-failure on node/zone.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isHaRelevant, type WorkloadMetadata } from './heuristics.js';

const CHECK_ID = 'reliability.spread-anti-affinity';
const CHECK_NAME = 'Pod Spread and Anti-Affinity';
const REMEDIATION =
  'Add podAntiAffinity or topologySpreadConstraints to spread pods across nodes/zones for HA workloads';

function getReplicas(
  spec: k8s.V1DeploymentSpec | k8s.V1StatefulSetSpec | undefined
): number {
  const raw = spec?.replicas;
  if (typeof raw === 'number' && raw >= 0) {
    return raw;
  }
  return 1;
}

function hasAntiAffinityOrSpread(
  spec: k8s.V1DeploymentSpec | k8s.V1StatefulSetSpec | undefined
): boolean {
  const template = spec?.template;
  const podSpec = template?.spec;
  if (!podSpec) return false;

  const hasAntiAffinity =
    (podSpec.affinity?.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.length ?? 0) > 0 ||
    (podSpec.affinity?.podAntiAffinity?.preferredDuringSchedulingIgnoredDuringExecution?.length ?? 0) > 0;

  const hasTopologySpread =
    (podSpec.topologySpreadConstraints?.length ?? 0) > 0;

  return hasAntiAffinity || hasTopologySpread;
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

export const spreadAntiAffinityCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description:
    'Validates that HA workloads have anti-affinity or topology spread constraints',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [deploymentsRes, statefulSetsRes] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
    ]);

    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];

    const violations: string[] = [];

    for (const d of deployments) {
      const meta = toWorkloadMeta(d.metadata, 'Deployment');
      if (!isHaRelevant(meta)) continue;

      const replicas = getReplicas(d.spec);
      if (replicas < 2) continue;

      if (!hasAntiAffinityOrSpread(d.spec)) {
        violations.push(`${meta.namespace}/${meta.name} (Deployment)`);
      }
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isHaRelevant(meta)) continue;

      const replicas = getReplicas(s.spec);
      if (replicas < 2) continue;

      if (!hasAntiAffinityOrSpread(s.spec)) {
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
        message: 'All multi-replica HA workloads have anti-affinity or topology spread',
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `HA workloads without spread/anti-affinity: ${violations.join(', ')}`
        : `${violations.length} HA workloads without spread/anti-affinity: ${violations.slice(0, 3).join(', ')}...`;

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
