/**
 * Cost optimization: resource request/limit ratio validation.
 *
 * Flags workloads where CPU or memory requests are very small compared to limits
 * (rightsizing opportunity) or where request exceeds limit (misconfiguration).
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isResourceCheckRelevant, type WorkloadMetadata } from '../reliability/heuristics.js';
import { parseCpuCores, parseMemoryBytes } from '../shared/resource-quantities.js';
import {
  classifyRequestLimitRatio,
  formatRatioPercent,
  RESOURCE_RATIO_FAIL_BELOW,
  RESOURCE_RATIO_WARN_BELOW,
} from './resource-ratio-heuristics.js';

const CHECK_ID = 'cost-optimization.resource-request-limit-ratios';
const CHECK_NAME = 'Resource Request/Limit Ratios';
const REMEDIATION =
  'Align requests with expected steady-state usage and limits with burst tolerance: raise requests or lower limits so request/limit is not extremely small; fix cases where request exceeds limit. Use kube9.io/resource-exempt=true only when intentional.';

function toWorkloadMeta(meta: k8s.V1ObjectMeta | undefined, kind: string): WorkloadMetadata {
  return {
    namespace: meta?.namespace ?? '',
    name: meta?.name ?? 'unknown',
    kind,
    labels: meta?.labels as Record<string, string> | undefined,
  };
}

interface RatioFinding {
  level: 'fail' | 'warn';
  text: string;
}

function pushCpuMemoryFindings(
  workload: string,
  containerName: string,
  resources: k8s.V1ResourceRequirements | undefined,
  out: RatioFinding[],
): void {
  const reqCpu = parseCpuCores(resources?.requests?.cpu);
  const limCpu = parseCpuCores(resources?.limits?.cpu);
  if (reqCpu !== undefined && limCpu !== undefined) {
    const cpuClass = classifyRequestLimitRatio(reqCpu, limCpu);
    if (cpuClass === 'fail') {
      if (reqCpu > limCpu) {
        out.push({
          level: 'fail',
          text: `${workload} container ${containerName}: CPU request (${reqCpu} cores) exceeds limit (${limCpu} cores)`,
        });
      } else {
        out.push({
          level: 'fail',
          text: `${workload} container ${containerName}: CPU request/limit ratio ${formatRatioPercent(reqCpu, limCpu)} is below ${RESOURCE_RATIO_FAIL_BELOW * 100}% (consider rightsizing requests or limits)`,
        });
      }
    } else if (cpuClass === 'warning') {
      out.push({
        level: 'warn',
        text: `${workload} container ${containerName}: CPU request/limit ratio ${formatRatioPercent(reqCpu, limCpu)} is below ${RESOURCE_RATIO_WARN_BELOW * 100}% (review for cost and scheduling efficiency)`,
      });
    }
  }

  const reqMem = parseMemoryBytes(resources?.requests?.memory);
  const limMem = parseMemoryBytes(resources?.limits?.memory);
  if (reqMem !== undefined && limMem !== undefined) {
    const memClass = classifyRequestLimitRatio(reqMem, limMem);
    if (memClass === 'fail') {
      if (reqMem > limMem) {
        out.push({
          level: 'fail',
          text: `${workload} container ${containerName}: memory request exceeds limit`,
        });
      } else {
        out.push({
          level: 'fail',
          text: `${workload} container ${containerName}: memory request/limit ratio ${formatRatioPercent(reqMem, limMem)} is below ${RESOURCE_RATIO_FAIL_BELOW * 100}% (consider rightsizing requests or limits)`,
        });
      }
    } else if (memClass === 'warning') {
      out.push({
        level: 'warn',
        text: `${workload} container ${containerName}: memory request/limit ratio ${formatRatioPercent(reqMem, limMem)} is below ${RESOURCE_RATIO_WARN_BELOW * 100}% (review for cost and scheduling efficiency)`,
      });
    }
  }
}

function collectRatioFindings(workload: string, template: k8s.V1PodTemplateSpec | undefined): RatioFinding[] {
  const out: RatioFinding[] = [];
  const containers = [
    ...(template?.spec?.initContainers ?? []),
    ...(template?.spec?.containers ?? []),
  ];
  for (const c of containers) {
    pushCpuMemoryFindings(workload, c.name ?? 'unknown', c.resources, out);
  }
  return out;
}

export const resourceRequestLimitRatiosCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.CostOptimization,
  description:
    'Evaluates CPU and memory request/limit ratios for inefficient sizing (extreme headroom or request above limit)',
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
      for (const f of collectRatioFindings(workload, d.spec?.template)) {
        if (f.level === 'fail') failures.push(f.text);
        else warnings.push(f.text);
      }
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (StatefulSet)`;
      for (const f of collectRatioFindings(workload, s.spec?.template)) {
        if (f.level === 'fail') failures.push(f.text);
        else warnings.push(f.text);
      }
    }

    for (const ds of daemonSets) {
      const meta = toWorkloadMeta(ds.metadata, 'DaemonSet');
      if (!isResourceCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (DaemonSet)`;
      for (const f of collectRatioFindings(workload, ds.spec?.template)) {
        if (f.level === 'fail') failures.push(f.text);
        else warnings.push(f.text);
      }
    }

    if (failures.length > 0) {
      const message =
        failures.length <= 5
          ? failures.join('; ')
          : `${failures.length} request/limit issues: ${failures.slice(0, 3).join('; ')}...`;
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
          : `${warnings.length} request/limit warnings: ${warnings.slice(0, 3).join('; ')}...`;
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
        'No inefficient CPU/memory request-to-limit ratios detected for in-scope workloads (where both request and limit are set)',
      remediation: REMEDIATION,
    };
  },
};
