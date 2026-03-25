import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isNamespaceExcluded } from '../reliability/heuristics.js';

const CHECK_ID = 'performance-efficiency.namespace-resource-governance';
const CHECK_NAME = 'Namespace Resource Governance';
const REMEDIATION =
  'Define ResourceQuota in production-like namespaces with requests/limits/pods bounds, and configure LimitRange defaults when workloads rely on implicit requests/limits.';

const PROD_LIKE_NAME = /(prod|production|stage|staging|critical)/i;
const PROD_LIKE_LABEL_VALUES = new Set(['prod', 'production', 'stage', 'staging', 'critical']);
const REQUIRED_QUOTA_KEYS = new Set([
  'requests.cpu',
  'requests.memory',
  'limits.cpu',
  'limits.memory',
  'pods',
]);

interface NamespaceUsage {
  requestedCpuCores: number;
  requestedMemoryBytes: number;
  desiredPods: number;
  containersMissingResources: number;
}

interface Finding {
  status: CheckStatus.Failing | CheckStatus.Warning;
  severity: Severity.High | Severity.Medium;
  message: string;
  objectKind?: string;
  objectNamespace?: string;
  objectName?: string;
}

function parseCpuCores(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.endsWith('m')) {
    const n = Number(raw.slice(0, -1));
    return Number.isFinite(n) ? n / 1000 : undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseMemoryBytes(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const match = raw.match(/^([0-9]*\.?[0-9]+)([a-zA-Z]+)?$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2] ?? '';

  const factors: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
    m: 0.001,
  };

  const factor = factors[unit];
  if (factor !== undefined) {
    return amount * factor;
  }
  if (!unit) {
    return amount;
  }
  return undefined;
}

function parseCount(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

function addContainerRequests(
  containers: k8s.V1Container[] | undefined,
  replicas: number,
  usage: NamespaceUsage,
): void {
  if (!containers || containers.length === 0 || replicas <= 0) return;
  for (const c of containers) {
    const cpu = parseCpuCores(c.resources?.requests?.cpu);
    const mem = parseMemoryBytes(c.resources?.requests?.memory);
    if (cpu !== undefined) usage.requestedCpuCores += cpu * replicas;
    if (mem !== undefined) usage.requestedMemoryBytes += mem * replicas;
    if (cpu === undefined || mem === undefined) usage.containersMissingResources += replicas;
  }
}

function ensureUsage(map: Map<string, NamespaceUsage>, namespace: string): NamespaceUsage {
  const existing = map.get(namespace);
  if (existing) return existing;
  const created: NamespaceUsage = {
    requestedCpuCores: 0,
    requestedMemoryBytes: 0,
    desiredPods: 0,
    containersMissingResources: 0,
  };
  map.set(namespace, created);
  return created;
}

function collectNamespaceUsage(
  deployments: k8s.V1Deployment[],
  statefulSets: k8s.V1StatefulSet[],
  daemonSets: k8s.V1DaemonSet[],
): Map<string, NamespaceUsage> {
  const usageByNamespace = new Map<string, NamespaceUsage>();

  for (const d of deployments) {
    const ns = d.metadata?.namespace;
    if (!ns || isNamespaceExcluded(ns)) continue;
    const replicas = d.spec?.replicas ?? 1;
    const usage = ensureUsage(usageByNamespace, ns);
    usage.desiredPods += replicas;
    addContainerRequests(d.spec?.template?.spec?.containers, replicas, usage);
    addContainerRequests(d.spec?.template?.spec?.initContainers, replicas, usage);
  }

  for (const s of statefulSets) {
    const ns = s.metadata?.namespace;
    if (!ns || isNamespaceExcluded(ns)) continue;
    const replicas = s.spec?.replicas ?? 1;
    const usage = ensureUsage(usageByNamespace, ns);
    usage.desiredPods += replicas;
    addContainerRequests(s.spec?.template?.spec?.containers, replicas, usage);
    addContainerRequests(s.spec?.template?.spec?.initContainers, replicas, usage);
  }

  for (const ds of daemonSets) {
    const ns = ds.metadata?.namespace;
    if (!ns || isNamespaceExcluded(ns)) continue;
    const replicas = ds.status?.desiredNumberScheduled ?? 1;
    const usage = ensureUsage(usageByNamespace, ns);
    usage.desiredPods += replicas;
    addContainerRequests(ds.spec?.template?.spec?.containers, replicas, usage);
    addContainerRequests(ds.spec?.template?.spec?.initContainers, replicas, usage);
  }

  return usageByNamespace;
}

function hasLimitRangeDefaults(limitRange: k8s.V1LimitRange): boolean {
  const limits = limitRange.spec?.limits ?? [];
  for (const item of limits) {
    const hasDefaultCpu = item._default?.cpu !== undefined || item.defaultRequest?.cpu !== undefined;
    const hasDefaultMemory = item._default?.memory !== undefined || item.defaultRequest?.memory !== undefined;
    if (hasDefaultCpu && hasDefaultMemory) return true;
  }
  return false;
}

function isProductionLike(namespace: string, labels: Record<string, string> | undefined, usage: NamespaceUsage): boolean {
  if (PROD_LIKE_NAME.test(namespace)) return true;
  const valuesToCheck = [
    labels?.environment,
    labels?.env,
    labels?.tier,
    labels?.['kube9.io/workload-profile'],
    labels?.['kube9.io/resource-governance'],
  ];
  if (valuesToCheck.some((v) => (v ? PROD_LIKE_LABEL_VALUES.has(v.toLowerCase()) : false))) {
    return true;
  }
  return usage.desiredPods >= 3;
}

function aggregateHard(quotas: k8s.V1ResourceQuota[]): Record<string, unknown> {
  const hard: Record<string, unknown> = {};
  for (const quota of quotas) {
    const qHard = quota.spec?.hard ?? {};
    for (const [key, value] of Object.entries(qHard)) {
      if (!(key in hard)) {
        hard[key] = value;
      }
    }
  }
  return hard;
}

function checkQuotaBounds(
  namespace: string,
  usage: NamespaceUsage,
  quota: k8s.V1ResourceQuota,
): Finding[] {
  const findings: Finding[] = [];
  const qName = quota.metadata?.name ?? 'unknown';
  const hard = quota.spec?.hard ?? {};
  const quotaKeys = new Set(Object.keys(hard));
  const hasComputeControls = [...REQUIRED_QUOTA_KEYS].some((k) => quotaKeys.has(k));
  if (!hasComputeControls) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} defines no cpu/memory/pods hard limits; quota may be too loose to protect cluster capacity.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  }

  const rqCpu = parseCpuCores(hard['requests.cpu']);
  const rqMemory = parseMemoryBytes(hard['requests.memory']);
  const limitCpu = parseCpuCores(hard['limits.cpu']);
  const limitMemory = parseMemoryBytes(hard['limits.memory']);
  const pods = parseCount(hard.pods);

  const usageCpu = usage.requestedCpuCores;
  const usageMemory = usage.requestedMemoryBytes;
  const usagePods = usage.desiredPods;

  if (rqCpu !== undefined && usageCpu > rqCpu) {
    findings.push({
      status: CheckStatus.Failing,
      severity: Severity.High,
      message: `${namespace}/${qName} requests.cpu (${rqCpu}) is below estimated workload requests (${usageCpu.toFixed(2)} cores); likely scheduling failures.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  } else if (rqCpu !== undefined && usageCpu > 0 && usageCpu / rqCpu >= 0.9) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} requests.cpu is near saturation (${(usageCpu / rqCpu * 100).toFixed(0)}% used by heuristic).`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  } else if (rqCpu !== undefined && usageCpu > 0 && rqCpu / usageCpu >= 20) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} requests.cpu is very high versus estimated demand (${(rqCpu / usageCpu).toFixed(1)}x); quota may be too loose.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  }

  if (rqMemory !== undefined && usageMemory > rqMemory) {
    findings.push({
      status: CheckStatus.Failing,
      severity: Severity.High,
      message: `${namespace}/${qName} requests.memory is below estimated workload requests; likely scheduling failures.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  } else if (rqMemory !== undefined && usageMemory > 0 && usageMemory / rqMemory >= 0.9) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} requests.memory is near saturation (${(usageMemory / rqMemory * 100).toFixed(0)}% used by heuristic).`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  } else if (rqMemory !== undefined && usageMemory > 0 && rqMemory / usageMemory >= 20) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} requests.memory is very high versus estimated demand (${(rqMemory / usageMemory).toFixed(1)}x); quota may be too loose.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  }

  if (limitCpu !== undefined && usageCpu > 0 && limitCpu / usageCpu >= 25) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} limits.cpu is very high versus estimated demand (${(limitCpu / usageCpu).toFixed(1)}x); quota may be too loose.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  }

  if (limitMemory !== undefined && usageMemory > 0 && limitMemory / usageMemory >= 25) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} limits.memory is very high versus estimated demand (${(limitMemory / usageMemory).toFixed(1)}x); quota may be too loose.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  }

  if (pods !== undefined && usagePods > pods) {
    findings.push({
      status: CheckStatus.Failing,
      severity: Severity.High,
      message: `${namespace}/${qName} pods (${pods}) is below estimated desired pod count (${usagePods}); likely scheduling failures.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  } else if (pods !== undefined && usagePods > 0 && usagePods / pods >= 0.9) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} pods quota is near saturation (${(usagePods / pods * 100).toFixed(0)}% used by heuristic).`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  } else if (pods !== undefined && usagePods > 0 && pods / usagePods >= 10) {
    findings.push({
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message: `${namespace}/${qName} pods quota is very high versus estimated demand (${(pods / usagePods).toFixed(1)}x); quota may be too loose.`,
      objectKind: 'ResourceQuota',
      objectNamespace: namespace,
      objectName: qName,
    });
  }

  return findings;
}

export const namespaceResourceGovernanceCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.PerformanceEfficiency,
  description:
    'Assesses namespace ResourceQuota and relevant LimitRange defaults using lightweight workload-to-quota heuristics.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [
      deploymentsRes,
      statefulSetsRes,
      daemonSetsRes,
      resourceQuotaRes,
      limitRangeRes,
      namespacesRes,
    ] = await Promise.all([
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
      ctx.kubernetes.appsApi.listDaemonSetForAllNamespaces(),
      ctx.kubernetes.coreApi.listResourceQuotaForAllNamespaces(),
      ctx.kubernetes.coreApi.listLimitRangeForAllNamespaces(),
      ctx.kubernetes.coreApi.listNamespace(),
    ]);

    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];
    const daemonSets = daemonSetsRes.items ?? [];
    const resourceQuotas = resourceQuotaRes.items ?? [];
    const limitRanges = limitRangeRes.items ?? [];
    const namespaces = namespacesRes.items ?? [];

    const usageByNamespace = collectNamespaceUsage(deployments, statefulSets, daemonSets);
    if (usageByNamespace.size === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Passing,
        severity: Severity.Low,
        message: 'No in-scope workloads found; namespace resource governance checks not applicable.',
        remediation: REMEDIATION,
      };
    }

    const namespaceMeta = new Map<string, Record<string, string>>();
    for (const ns of namespaces) {
      const name = ns.metadata?.name;
      if (!name) continue;
      namespaceMeta.set(name, ns.metadata?.labels ?? {});
    }

    const quotaByNamespace = new Map<string, k8s.V1ResourceQuota[]>();
    for (const quota of resourceQuotas) {
      const ns = quota.metadata?.namespace;
      if (!ns || !usageByNamespace.has(ns)) continue;
      const arr = quotaByNamespace.get(ns) ?? [];
      arr.push(quota);
      quotaByNamespace.set(ns, arr);
    }

    const limitRangeByNamespace = new Map<string, k8s.V1LimitRange[]>();
    for (const lr of limitRanges) {
      const ns = lr.metadata?.namespace;
      if (!ns || !usageByNamespace.has(ns)) continue;
      const arr = limitRangeByNamespace.get(ns) ?? [];
      arr.push(lr);
      limitRangeByNamespace.set(ns, arr);
    }

    const findings: Finding[] = [];
    const summary: string[] = [];

    for (const [namespace, usage] of usageByNamespace.entries()) {
      const labels = namespaceMeta.get(namespace);
      const governanceRequired = isProductionLike(namespace, labels, usage);
      const namespaceQuotas = quotaByNamespace.get(namespace) ?? [];
      const namespaceLimitRanges = limitRangeByNamespace.get(namespace) ?? [];

      summary.push(
        `${namespace} (ResourceQuota=${namespaceQuotas.length}, LimitRange=${namespaceLimitRanges.length})`,
      );

      if (governanceRequired && namespaceQuotas.length === 0) {
        findings.push({
          status: CheckStatus.Warning,
          severity: Severity.Medium,
          message:
            `${namespace} has production-like workload signals but no ResourceQuota; ` +
            'define requests/limits/pods safeguards to prevent noisy-neighbor contention.',
          objectKind: 'Namespace',
          objectNamespace: namespace,
          objectName: namespace,
        });
      }

      for (const quota of namespaceQuotas) {
        findings.push(...checkQuotaBounds(namespace, usage, quota));
      }

      if (governanceRequired && usage.containersMissingResources > 0) {
        const hasDefaults = namespaceLimitRanges.some(hasLimitRangeDefaults);
        if (!hasDefaults) {
          findings.push({
            status: CheckStatus.Warning,
            severity: Severity.Medium,
            message:
              `${namespace} has containers without explicit requests/limits and no LimitRange defaults; ` +
              'add defaultRequest/default cpu+memory values for safer baseline scheduling.',
            objectKind: 'LimitRange',
            objectNamespace: namespace,
          });
        }
      }
    }

    if (findings.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: `Namespace governance looks reasonable. Enumerated: ${summary.join('; ')}`,
        remediation: REMEDIATION,
      };
    }

    const hasFailing = findings.some((f) => f.status === CheckStatus.Failing);
    const status = hasFailing ? CheckStatus.Failing : CheckStatus.Warning;
    const severity = hasFailing ? Severity.High : Severity.Medium;
    const first = findings[0];
    const headline =
      findings.length <= 5
        ? findings.map((f) => f.message).join('; ')
        : `${findings.length} governance issues detected: ${findings
            .slice(0, 3)
            .map((f) => f.message)
            .join('; ')}...`;

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.PerformanceEfficiency,
      status,
      severity,
      message: `${headline} | Enumerated: ${summary.join('; ')}`,
      objectKind: first.objectKind,
      objectNamespace: first.objectNamespace,
      objectName: first.objectName,
      remediation: REMEDIATION,
    };
  },
};
