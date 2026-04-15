/**
 * Cost optimization: over-provisioning detection from declared requests.
 *
 * Uses only Kubernetes workload configuration (no metrics). Heuristics flag
 * per-pod or fleet-level CPU/memory requests that are far above typical
 * service needs — a signal to right-size or revisit quota / limits.
 *
 * Heuristics (see exported constants for tunable thresholds):
 * - Effective per-pod request = max(sum(initContainers requests), sum(containers requests)) per resource.
 * - Warn/fail when per-pod CPU or memory requests exceed configured ceilings.
 * - Warn/fail when total reservation (replicas × per-pod request) exceeds fleet-level ceilings.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isResourceCheckRelevant, type WorkloadMetadata } from '../reliability/heuristics.js';
import { parseCpuCores, parseMemoryBytes } from '../shared/resource-quantities.js';

const CHECK_ID = 'cost-optimization.over-provisioning-detection';
const CHECK_NAME = 'Over-Provisioning Detection';

const REMEDIATION =
  'Validate actual CPU and memory usage (metrics, Vertical Pod Autoscaler recommendations, or load tests), then lower requests/limits and quotas to match steady-state need plus a modest buffer. Tighten namespace ResourceQuota if capacity was reserved but workloads use far less.';

/** Per-pod CPU request (cores) at or above: warning — likely more than typical microservices need. */
export const OVERPROVISION_PER_POD_CPU_WARN_CORES = 4;
/** Per-pod CPU request (cores) at or above: failing — material over-provisioning for a single pod. */
export const OVERPROVISION_PER_POD_CPU_FAIL_CORES = 16;

/** Per-pod memory request (bytes) at or above: warning. */
export const OVERPROVISION_PER_POD_MEMORY_WARN_BYTES = 16 * 1024 ** 3;
/** Per-pod memory request (bytes) at or above: failing. */
export const OVERPROVISION_PER_POD_MEMORY_FAIL_BYTES = 64 * 1024 ** 3;

/** Total workload CPU reservation (replicas × effective per-pod CPU) in cores: warning. */
export const OVERPROVISION_TOTAL_CPU_WARN_CORES = 32;
/** Total workload CPU reservation: failing. */
export const OVERPROVISION_TOTAL_CPU_FAIL_CORES = 128;

/** Total workload memory reservation (replicas × per-pod memory): warning. */
export const OVERPROVISION_TOTAL_MEMORY_WARN_BYTES = 256 * 1024 ** 3;
/** Total workload memory reservation: failing (1 TiB). */
export const OVERPROVISION_TOTAL_MEMORY_FAIL_BYTES = 1024 ** 4;

type FindingLevel = 'fail' | 'warn';

interface Finding {
  level: FindingLevel;
  text: string;
}

function toWorkloadMeta(meta: k8s.V1ObjectMeta | undefined, kind: string): WorkloadMetadata {
  return {
    namespace: meta?.namespace ?? '',
    name: meta?.name ?? 'unknown',
    kind,
    labels: meta?.labels as Record<string, string> | undefined,
  };
}

function sumContainerCpuRequests(containers: k8s.V1Container[] | undefined): number {
  if (!containers?.length) return 0;
  let sum = 0;
  for (const c of containers) {
    const v = parseCpuCores(c.resources?.requests?.cpu);
    if (v !== undefined) sum += v;
  }
  return sum;
}

function sumContainerMemoryRequests(containers: k8s.V1Container[] | undefined): number {
  if (!containers?.length) return 0;
  let sum = 0;
  for (const c of containers) {
    const v = parseMemoryBytes(c.resources?.requests?.memory);
    if (v !== undefined) sum += v;
  }
  return sum;
}

/**
 * Effective scheduling request for CPU: max(init sum, app sum), matching Kubernetes
 * overlap rules for init vs workload containers.
 */
function effectivePodCpuRequestCores(template: k8s.V1PodTemplateSpec | undefined): number {
  const init = sumContainerCpuRequests(template?.spec?.initContainers);
  const app = sumContainerCpuRequests(template?.spec?.containers);
  return Math.max(init, app);
}

function effectivePodMemoryRequestBytes(template: k8s.V1PodTemplateSpec | undefined): number {
  const init = sumContainerMemoryRequests(template?.spec?.initContainers);
  const app = sumContainerMemoryRequests(template?.spec?.containers);
  return Math.max(init, app);
}

function formatGi(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
}

function classifyCpu(
  workload: string,
  perPodCores: number,
  totalCores: number,
  out: Finding[],
): void {
  if (perPodCores <= 0 && totalCores <= 0) return;

  if (perPodCores >= OVERPROVISION_PER_POD_CPU_FAIL_CORES) {
    out.push({
      level: 'fail',
      text: `${workload}: per-pod CPU requests total ${perPodCores.toFixed(2)} cores (>= ${OVERPROVISION_PER_POD_CPU_FAIL_CORES}); verify need or right-size`,
    });
  } else if (perPodCores >= OVERPROVISION_PER_POD_CPU_WARN_CORES) {
    out.push({
      level: 'warn',
      text: `${workload}: per-pod CPU requests ${perPodCores.toFixed(2)} cores (>= ${OVERPROVISION_PER_POD_CPU_WARN_CORES}); review for over-provisioning`,
    });
  }

  if (totalCores >= OVERPROVISION_TOTAL_CPU_FAIL_CORES) {
    out.push({
      level: 'fail',
      text: `${workload}: total CPU reservation ~${totalCores.toFixed(2)} cores (replicas × per-pod, >= ${OVERPROVISION_TOTAL_CPU_FAIL_CORES}); review aggregate capacity`,
    });
  } else if (totalCores >= OVERPROVISION_TOTAL_CPU_WARN_CORES) {
    out.push({
      level: 'warn',
      text: `${workload}: total CPU reservation ~${totalCores.toFixed(2)} cores (>= ${OVERPROVISION_TOTAL_CPU_WARN_CORES}); review fleet sizing`,
    });
  }
}

function classifyMemory(
  workload: string,
  perPodBytes: number,
  totalBytes: number,
  out: Finding[],
): void {
  if (perPodBytes <= 0 && totalBytes <= 0) return;

  if (perPodBytes >= OVERPROVISION_PER_POD_MEMORY_FAIL_BYTES) {
    out.push({
      level: 'fail',
      text: `${workload}: per-pod memory requests ${formatGi(perPodBytes)} (>= ${formatGi(OVERPROVISION_PER_POD_MEMORY_FAIL_BYTES)}); verify need or right-size`,
    });
  } else if (perPodBytes >= OVERPROVISION_PER_POD_MEMORY_WARN_BYTES) {
    out.push({
      level: 'warn',
      text: `${workload}: per-pod memory requests ${formatGi(perPodBytes)} (>= ${formatGi(OVERPROVISION_PER_POD_MEMORY_WARN_BYTES)}); review for over-provisioning`,
    });
  }

  if (totalBytes >= OVERPROVISION_TOTAL_MEMORY_FAIL_BYTES) {
    out.push({
      level: 'fail',
      text: `${workload}: total memory reservation ~${formatGi(totalBytes)} (>= ${formatGi(OVERPROVISION_TOTAL_MEMORY_FAIL_BYTES)}); review aggregate capacity`,
    });
  } else if (totalBytes >= OVERPROVISION_TOTAL_MEMORY_WARN_BYTES) {
    out.push({
      level: 'warn',
      text: `${workload}: total memory reservation ~${formatGi(totalBytes)} (>= ${formatGi(OVERPROVISION_TOTAL_MEMORY_WARN_BYTES)}); review fleet sizing`,
    });
  }
}

function collectWorkloadFindings(
  workload: string,
  template: k8s.V1PodTemplateSpec | undefined,
  replicas: number,
  out: Finding[],
): void {
  if (replicas <= 0) return;
  const perPodCpu = effectivePodCpuRequestCores(template);
  const perPodMem = effectivePodMemoryRequestBytes(template);
  const totalCpu = perPodCpu * replicas;
  const totalMem = perPodMem * replicas;
  classifyCpu(workload, perPodCpu, totalCpu, out);
  classifyMemory(workload, perPodMem, totalMem, out);
}

export const overProvisioningDetectionCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.CostOptimization,
  description:
    'Flags declared CPU/memory requests that suggest over-provisioning at per-pod or scaled workload level (configuration-only heuristics)',
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

    const failures: string[] = [];
    const warnings: string[] = [];

    for (const d of deployments) {
      const meta = toWorkloadMeta(d.metadata, 'Deployment');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (Deployment)`;
      const findings: Finding[] = [];
      const replicas = d.spec?.replicas ?? 0;
      collectWorkloadFindings(workload, d.spec?.template, replicas, findings);
      for (const f of findings) {
        if (f.level === 'fail') failures.push(f.text);
        else warnings.push(f.text);
      }
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (StatefulSet)`;
      const findings: Finding[] = [];
      const replicas = s.spec?.replicas ?? 0;
      collectWorkloadFindings(workload, s.spec?.template, replicas, findings);
      for (const f of findings) {
        if (f.level === 'fail') failures.push(f.text);
        else warnings.push(f.text);
      }
    }

    for (const ds of daemonSets) {
      const meta = toWorkloadMeta(ds.metadata, 'DaemonSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (DaemonSet)`;
      const findings: Finding[] = [];
      const replicas = ds.status?.desiredNumberScheduled ?? 0;
      collectWorkloadFindings(workload, ds.spec?.template, replicas, findings);
      for (const f of findings) {
        if (f.level === 'fail') failures.push(f.text);
        else warnings.push(f.text);
      }
    }

    if (failures.length > 0) {
      const message =
        failures.length <= 5
          ? failures.join('; ')
          : `${failures.length} over-provisioning issues: ${failures.slice(0, 3).join('; ')}...`;
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.CostOptimization,
        status: CheckStatus.Failing,
        severity: Severity.High,
        objectKind: 'Deployment',
        message,
        remediation: REMEDIATION,
      };
    }

    if (warnings.length > 0) {
      const message =
        warnings.length <= 5
          ? warnings.join('; ')
          : `${warnings.length} over-provisioning warnings: ${warnings.slice(0, 3).join('; ')}...`;
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.CostOptimization,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        objectKind: 'Deployment',
        message,
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
        'No likely over-provisioning from declared requests for in-scope workloads (per thresholds in over-provisioning-detection)',
      remediation: REMEDIATION,
    };
  },
};
