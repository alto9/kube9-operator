/**
 * Sustainability: resource efficiency signals (declared requests vs allocatable).
 *
 * Compares aggregate CPU/memory requests from in-scope workloads to schedulable
 * node allocatable. Very low reservation ratios suggest idle capacity that often
 * correlates with higher per-unit-work infrastructure energy — a consolidation /
 * rightsizing nudge from a sustainability lens (configuration-only; no metrics).
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isResourceCheckRelevant, type WorkloadMetadata } from '../reliability/heuristics.js';
import { parseCpuCores, parseMemoryBytes } from '../shared/resource-quantities.js';

const CHECK_ID = 'sustainability.resource-efficiency-signals';
const CHECK_NAME = 'Resource Efficiency Signals';
const REMEDIATION =
  'Increase workload density (fewer/larger nodes where safe), right-size nodes to match steady demand, or raise requests where they are intentionally low so scheduling reflects real need. Pair changes with capacity and reliability review; use kube9.io/resource-exempt=true only when intentional.';

/** Warn when reserved CPU is below this fraction of allocatable (idle signal). */
export const IDLE_ALLOCATABLE_UTILIZATION_WARN = 0.15;
/** Warn when reserved memory is below this fraction of allocatable. */
export const IDLE_MEMORY_UTILIZATION_WARN = 0.15;

/** Only emit idle-capacity warnings when allocatable CPU is at least this many cores. */
export const MIN_ALLOCATABLE_CPU_CORES_FOR_IDLE_SIGNAL = 4;
/** Only emit idle-capacity warnings when allocatable memory is at least this many bytes. */
export const MIN_ALLOCATABLE_MEMORY_BYTES_FOR_IDLE_SIGNAL = 8 * 1024 ** 3;

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

function sumSchedulableAllocatable(nodes: k8s.V1Node[]): { cpuCores: number; memoryBytes: number } {
  let cpuCores = 0;
  let memoryBytes = 0;
  for (const n of nodes) {
    if (n.spec?.unschedulable) continue;
    const alloc = n.status?.allocatable;
    const c = parseCpuCores(alloc?.cpu);
    const m = parseMemoryBytes(alloc?.memory);
    if (c !== undefined) cpuCores += c;
    if (m !== undefined) memoryBytes += m;
  }
  return { cpuCores, memoryBytes };
}

function sumFleetRequests(
  deployments: k8s.V1Deployment[],
  statefulSets: k8s.V1StatefulSet[],
  daemonSets: k8s.V1DaemonSet[],
): { cpuCores: number; memoryBytes: number } {
  let cpuCores = 0;
  let memoryBytes = 0;

  for (const d of deployments) {
    const meta = toWorkloadMeta(d.metadata, 'Deployment');
    if (!isResourceCheckRelevant(meta)) continue;
    const replicas = d.spec?.replicas ?? 0;
    if (replicas <= 0) continue;
    const tpl = d.spec?.template;
    cpuCores += effectivePodCpuRequestCores(tpl) * replicas;
    memoryBytes += effectivePodMemoryRequestBytes(tpl) * replicas;
  }

  for (const s of statefulSets) {
    const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
    if (!isResourceCheckRelevant(meta)) continue;
    const replicas = s.spec?.replicas ?? 0;
    if (replicas <= 0) continue;
    const tpl = s.spec?.template;
    cpuCores += effectivePodCpuRequestCores(tpl) * replicas;
    memoryBytes += effectivePodMemoryRequestBytes(tpl) * replicas;
  }

  for (const ds of daemonSets) {
    const meta = toWorkloadMeta(ds.metadata, 'DaemonSet');
    if (!isResourceCheckRelevant(meta)) continue;
    const replicas = ds.status?.desiredNumberScheduled ?? 0;
    if (replicas <= 0) continue;
    const tpl = ds.spec?.template;
    cpuCores += effectivePodCpuRequestCores(tpl) * replicas;
    memoryBytes += effectivePodMemoryRequestBytes(tpl) * replicas;
  }

  return { cpuCores, memoryBytes };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export const resourceEfficiencySignalsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Sustainability,
  description:
    'Surfaces low declared request utilization versus node allocatable as a sustainability-oriented capacity signal',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [nodesRes, deploymentsRes, statefulSetsRes, daemonSetsRes] = await Promise.all([
      ctx.kubernetes.coreApi.listNode(),
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
      ctx.kubernetes.appsApi.listDaemonSetForAllNamespaces(),
    ]);

    const nodes = nodesRes.items ?? [];
    const { cpuCores: allocCpu, memoryBytes: allocMem } = sumSchedulableAllocatable(nodes);

    if (allocCpu <= 0 && allocMem <= 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Sustainability,
        status: CheckStatus.Skipped,
        severity: Severity.Low,
        message:
          'No schedulable nodes with parseable CPU/memory allocatable; cannot evaluate fleet vs capacity signal',
        remediation: REMEDIATION,
      };
    }

    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];
    const daemonSets = daemonSetsRes.items ?? [];
    const fleet = sumFleetRequests(deployments, statefulSets, daemonSets);

    const cpuUtil = allocCpu > 0 ? fleet.cpuCores / allocCpu : undefined;
    const memUtil = allocMem > 0 ? fleet.memoryBytes / allocMem : undefined;

    const idleCpu =
      allocCpu >= MIN_ALLOCATABLE_CPU_CORES_FOR_IDLE_SIGNAL &&
      cpuUtil !== undefined &&
      cpuUtil < IDLE_ALLOCATABLE_UTILIZATION_WARN;
    const idleMem =
      allocMem >= MIN_ALLOCATABLE_MEMORY_BYTES_FOR_IDLE_SIGNAL &&
      memUtil !== undefined &&
      memUtil < IDLE_MEMORY_UTILIZATION_WARN;

    if (idleCpu || idleMem) {
      const parts: string[] = [];
      if (idleCpu) {
        parts.push(
          `CPU requests ~${fleet.cpuCores.toFixed(2)} cores vs ${allocCpu.toFixed(2)} cores allocatable (${pct(cpuUtil!)} reserved; threshold ${pct(IDLE_ALLOCATABLE_UTILIZATION_WARN)})`,
        );
      }
      if (idleMem) {
        parts.push(
          `memory requests ~${(fleet.memoryBytes / 1024 ** 3).toFixed(1)}Gi vs ${(allocMem / 1024 ** 3).toFixed(1)}Gi allocatable (${pct(memUtil!)} reserved; threshold ${pct(IDLE_MEMORY_UTILIZATION_WARN)})`,
        );
      }
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Sustainability,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        objectKind: 'Node',
        message: `Low declared utilization versus allocatable (sustainability / capacity signal): ${parts.join('; ')}`,
        remediation: REMEDIATION,
      };
    }

    const detailParts: string[] = [];
    if (cpuUtil !== undefined) {
      detailParts.push(`CPU reserved ${pct(cpuUtil)} of allocatable`);
    }
    if (memUtil !== undefined) {
      detailParts.push(`memory reserved ${pct(memUtil)} of allocatable`);
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Sustainability,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message:
        detailParts.length > 0
          ? `Declared requests are within sustainability idle-capacity heuristics (${detailParts.join('; ')})`
          : 'Declared requests are within sustainability idle-capacity heuristics',
      remediation: REMEDIATION,
    };
  },
};
