/**
 * Sustainability: workload consolidation / density signals.
 *
 * Surfaces replica sprawl among in-scope Deployments (many discrete one-replica
 * apps), a consolidation hint from a sustainability lens. Does not evaluate
 * PDBs, anti-affinity, or spread constraints — those stay in reliability checks.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isResourceCheckRelevant, type WorkloadMetadata } from '../reliability/heuristics.js';

const CHECK_ID = 'sustainability.workload-consolidation-signals';
const CHECK_NAME = 'Workload Consolidation Signals';
const REMEDIATION =
  'Where SLOs allow, reduce discrete Deployment sprawl (merge services, share runtimes, or scale replicas on hot paths) to cut packaging and scheduling overhead. Treat databases and intentional singletons as exceptions; use kube9.io/resource-exempt=true only when deliberate, and validate with capacity and reliability review.';

/** Minimum active in-scope Deployments before sprawl ratio is meaningful. */
export const MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL = 8;
/** Warn when this fraction or more of those Deployments run exactly one replica. */
export const SINGLE_REPLICA_DEPLOYMENT_SHARE_WARN = 0.6;

function toWorkloadMeta(meta: k8s.V1ObjectMeta | undefined, kind: string): WorkloadMetadata {
  return {
    namespace: meta?.namespace ?? '',
    name: meta?.name ?? 'unknown',
    kind,
    labels: meta?.labels as Record<string, string> | undefined,
  };
}

function deploymentReplicas(spec: k8s.V1DeploymentSpec | undefined): number {
  return spec?.replicas ?? 1;
}

export const workloadConsolidationSignalsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Sustainability,
  description:
    'Flags high single-replica Deployment sprawl among in-scope workloads as a consolidation / density signal',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const deploymentsRes = await ctx.kubernetes.appsApi.listDeploymentForAllNamespaces();
    const deployments = deploymentsRes.items ?? [];

    let active = 0;
    let singleReplica = 0;

    for (const d of deployments) {
      const meta = toWorkloadMeta(d.metadata, 'Deployment');
      if (!isResourceCheckRelevant(meta)) continue;
      const replicas = deploymentReplicas(d.spec);
      if (replicas <= 0) continue;
      active++;
      if (replicas === 1) singleReplica++;
    }

    if (active < MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Sustainability,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: `Only ${active} active in-scope Deployment(s); need at least ${MIN_DEPLOYMENTS_FOR_SPRAWL_SIGNAL} to evaluate replica sprawl heuristics`,
        remediation: REMEDIATION,
      };
    }

    const share = singleReplica / active;
    if (share >= SINGLE_REPLICA_DEPLOYMENT_SHARE_WARN) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Sustainability,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        objectKind: 'Deployment',
        message: `High single-replica Deployment sprawl: ${singleReplica} of ${active} in-scope Deployments run one replica (${(share * 100).toFixed(0)}% ≥ ${(SINGLE_REPLICA_DEPLOYMENT_SHARE_WARN * 100).toFixed(0)}% threshold) — consolidation may improve fleet density`,
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Sustainability,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message: `Replica sprawl heuristics nominal: ${singleReplica} of ${active} in-scope Deployments are single-replica (${(share * 100).toFixed(0)}%)`,
      remediation: REMEDIATION,
    };
  },
};
