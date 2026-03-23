/**
 * Reliability Check: Resource Limits
 *
 * Warns when containers lack CPU or memory limits. Burstable QoS (requests without limits)
 * can lead to eviction under memory pressure or unpredictable CPU throttling.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  isResourceCheckRelevant,
  type WorkloadMetadata,
} from './heuristics.js';

const CHECK_ID = 'reliability.resource-limits';
const CHECK_NAME = 'Resource Limits';
const REMEDIATION =
  'Set resources.limits.cpu and resources.limits.memory on all containers for predictable QoS; or label workload with kube9.io/resource-exempt=true';

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

function hasCpuLimit(resources: k8s.V1ResourceRequirements | undefined): boolean {
  const v = resources?.limits?.cpu;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function hasMemoryLimit(resources: k8s.V1ResourceRequirements | undefined): boolean {
  const v = resources?.limits?.memory;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function collectMissingLimits(
  workload: string,
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
    if (!hasCpuLimit(res)) missing.push('cpu limit');
    if (!hasMemoryLimit(res)) missing.push('memory limit');
    if (missing.length > 0) {
      violations.push(`${workload} container ${c.name ?? 'unknown'}: missing ${missing.join(', ')}`);
    }
  }
  return violations;
}

export const resourceLimitsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description: 'Warns when containers lack CPU or memory limits (burstable QoS)',
  defaultSeverity: Severity.Low,

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
      violations.push(...collectMissingLimits(workload, d.spec?.template));
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (StatefulSet)`;
      violations.push(...collectMissingLimits(workload, s.spec?.template));
    }

    for (const ds of daemonSets) {
      const meta = toWorkloadMeta(ds.metadata, 'DaemonSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (DaemonSet)`;
      violations.push(...collectMissingLimits(workload, ds.spec?.template));
    }

    if (violations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Reliability,
        status: CheckStatus.Passing,
        severity: Severity.Low,
        message: 'All containers in scope have CPU and memory limits',
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `Workloads missing resource limits: ${violations.join('; ')}`
        : `${violations.length} containers missing limits: ${violations.slice(0, 3).join('; ')}...`;

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Reliability,
      status: CheckStatus.Warning,
      severity: Severity.Low,
      objectKind: 'Deployment',
      message,
      remediation: REMEDIATION,
    };
  },
};
