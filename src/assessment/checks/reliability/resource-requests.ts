/**
 * Reliability Check: Resource Requests
 *
 * Validates that containers define CPU and memory requests where required by policy.
 * Default: all containers (incl. init, sidecars) in user namespaces; system namespaces excluded.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  isResourceCheckRelevant,
  type WorkloadMetadata,
} from './heuristics.js';

const CHECK_ID = 'reliability.resource-requests';
const CHECK_NAME = 'Resource Requests';
const REMEDIATION =
  'Set resources.requests.cpu and resources.requests.memory on all containers; or label workload with kube9.io/resource-exempt=true';

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

function hasCpuRequest(resources: k8s.V1ResourceRequirements | undefined): boolean {
  const v = resources?.requests?.cpu;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function hasMemoryRequest(resources: k8s.V1ResourceRequirements | undefined): boolean {
  const v = resources?.requests?.memory;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function collectMissingRequests(
  workload: string,
  kind: string,
  template: k8s.V1PodTemplateSpec | undefined
): string[] {
  const violations: string[] = [];
  const containers = [
    ...(template?.spec?.initContainers ?? []),
    ...(template?.spec?.containers ?? []),
  ];
  for (const c of containers) {
    const res = c.resources;
    const missing: string[] = [];
    if (!hasCpuRequest(res)) missing.push('cpu request');
    if (!hasMemoryRequest(res)) missing.push('memory request');
    if (missing.length > 0) {
      violations.push(`${workload} container ${c.name ?? 'unknown'}: missing ${missing.join(', ')}`);
    }
  }
  return violations;
}

export const resourceRequestsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description: 'Validates that containers define CPU and memory requests',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [deploymentsRes, statefulSetsRes, daemonSetsRes] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
      ctx.kubernetes.appsApi.listDaemonSetForAllNamespaces(),
    ]);

    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];
    const daemonSets = daemonSetsRes.items ?? [];

    const violations: string[] = [];

    for (const d of deployments) {
      const meta = toWorkloadMeta(d.metadata, 'Deployment');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (Deployment)`;
      violations.push(...collectMissingRequests(workload, 'Deployment', d.spec?.template));
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (StatefulSet)`;
      violations.push(...collectMissingRequests(workload, 'StatefulSet', s.spec?.template));
    }

    for (const ds of daemonSets) {
      const meta = toWorkloadMeta(ds.metadata, 'DaemonSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (DaemonSet)`;
      violations.push(...collectMissingRequests(workload, 'DaemonSet', ds.spec?.template));
    }

    if (violations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Reliability,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: 'All containers in scope have CPU and memory requests',
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `Workloads missing resource requests: ${violations.join('; ')}`
        : `${violations.length} containers missing requests: ${violations.slice(0, 3).join('; ')}...`;

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
