/**
 * Reliability Check: Replica Counts
 *
 * Detects workloads that should be highly available but run with insufficient replicas
 * (e.g., replicas < 2 for selected controller kinds).
 *
 * Default rules: Deployment and StatefulSet with replicas < 2 are flagged.
 * To extend: use kube9.io/ha-required (allowlist) or kube9.io/ha-exempt (denylist).
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  isHaRelevant,
  MIN_HA_REPLICAS,
  type WorkloadMetadata,
} from './heuristics.js';

const CHECK_ID = 'reliability.replica-counts';
const CHECK_NAME = 'High Availability Replica Counts';
const REMEDIATION =
  `Scale replicas to at least ${MIN_HA_REPLICAS} for HA; or label with kube9.io/ha-exempt=true if single-replica is intentional`;

function getReplicas(
  spec: k8s.V1DeploymentSpec | k8s.V1StatefulSetSpec | undefined
): number {
  const raw = spec?.replicas;
  if (typeof raw === 'number' && raw >= 0) {
    return raw;
  }
  return 1; // default when unspecified
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

export const replicaCountsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description:
    'Detects workloads that should be HA but run with insufficient replicas',
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
      if (replicas < MIN_HA_REPLICAS) {
        violations.push(`${meta.namespace}/${meta.name} (Deployment): replicas=${replicas}`);
      }
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isHaRelevant(meta)) continue;

      const replicas = getReplicas(s.spec);
      if (replicas < MIN_HA_REPLICAS) {
        violations.push(`${meta.namespace}/${meta.name} (StatefulSet): replicas=${replicas}`);
      }
    }

    if (violations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Reliability,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: `All HA workloads have at least ${MIN_HA_REPLICAS} replicas`,
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `Workloads with insufficient replicas: ${violations.join(', ')}`
        : `${violations.length} workloads with insufficient replicas: ${violations.slice(0, 3).join(', ')}...`;

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Reliability,
      status: CheckStatus.Failing,
      severity: Severity.Medium,
      objectKind: 'Deployment',
      message,
      remediation: REMEDIATION,
    };
  },
};
