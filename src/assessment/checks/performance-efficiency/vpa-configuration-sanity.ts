import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'performance-efficiency.vpa-configuration-sanity';
const CHECK_NAME = 'VPA Configuration Sanity';
const VPA_CRD = 'verticalpodautoscalers.autoscaling.k8s.io';
const VPA_GROUP = 'autoscaling.k8s.io';
const VPA_VERSION = 'v1';
const VPA_PLURAL = 'verticalpodautoscalers';
const VALID_UPDATE_MODES = new Set(['Off', 'Initial', 'Recreate', 'Auto']);
const REMEDIATION =
  'Install the VPA CRD/controller and define VPAs with valid targetRef and updatePolicy.updateMode. Use updateMode=Off for recommendation-only workflows.';

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

function toErrorStatusCode(err: unknown): number | undefined {
  const error = err as {
    response?: { statusCode?: number; body?: { reason?: string } };
    statusCode?: number;
    body?: { reason?: string };
    message?: string;
  };
  return error.response?.statusCode ?? error.statusCode;
}

function isNotFoundError(err: unknown): boolean {
  const error = err as {
    response?: { statusCode?: number; body?: { reason?: string } };
    statusCode?: number;
    body?: { reason?: string };
    message?: string;
  };

  if (toErrorStatusCode(err) === 404) {
    return true;
  }

  const reason = error.response?.body?.reason ?? error.body?.reason;
  if (reason === 'NotFound') {
    return true;
  }

  const message = error.message ?? (err instanceof Error ? err.message : String(err));
  return message.includes('NotFound') || message.includes('not found') || message.includes('HTTP-Code: 404');
}

function isInScopeNamespace(namespace: string | undefined): namespace is string {
  return typeof namespace === 'string' && namespace.length > 0 && !EXCLUDED_NAMESPACES.has(namespace);
}

function getVpaItems(payload: unknown): Array<Record<string, unknown>> {
  const top = payload as { body?: { items?: unknown[] }; items?: unknown[] };
  const raw = top.body?.items ?? top.items ?? [];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function getNestedString(obj: Record<string, unknown>, path: string[]): string | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export const vpaConfigurationSanityCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.PerformanceEfficiency,
  description:
    'Validates VPA optional-CRD behavior and VPA sanity (targetRef and update mode) when available.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    try {
      await ctx.kubernetes.apiextensionsApi.readCustomResourceDefinition({ name: VPA_CRD });
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        return {
          checkId: CHECK_ID,
          checkName: CHECK_NAME,
          pillar: Pillar.PerformanceEfficiency,
          status: CheckStatus.Skipped,
          severity: Severity.Low,
          message: 'VPA CRD not detected; skipping check in this cluster.',
          remediation: REMEDIATION,
        };
      }
      throw err;
    }

    const [vpaRes, deploymentsRes, statefulSetsRes] = await Promise.all([
      ctx.kubernetes.customObjectsApi.listClusterCustomObject({
        group: VPA_GROUP,
        version: VPA_VERSION,
        plural: VPA_PLURAL,
      }),
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
      ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces(),
    ]);

    const deployments = deploymentsRes.items ?? [];
    const statefulSets = statefulSetsRes.items ?? [];
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

    const vpas = getVpaItems(vpaRes);
    if (vpas.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Warning,
        severity: Severity.Low,
        message: 'VPA CRD is installed, but no VPA objects were found in the cluster.',
        remediation: REMEDIATION,
      };
    }

    const invalid: string[] = [];
    let recommendationOnly = 0;
    let validCount = 0;

    for (const vpa of vpas) {
      const ns = getNestedString(vpa, ['metadata', 'namespace']) ?? 'default';
      if (!isInScopeNamespace(ns)) continue;

      const name = getNestedString(vpa, ['metadata', 'name']) ?? 'unknown';
      const targetKind = getNestedString(vpa, ['spec', 'targetRef', 'kind']);
      const targetName = getNestedString(vpa, ['spec', 'targetRef', 'name']);
      const updateMode = getNestedString(vpa, ['spec', 'updatePolicy', 'updateMode']) ?? 'Auto';

      if (!targetKind || !targetName) {
        invalid.push(`${ns}/${name}: missing spec.targetRef kind/name`);
        continue;
      }

      if (targetKind !== 'Deployment' && targetKind !== 'StatefulSet') {
        invalid.push(`${ns}/${name}: unsupported targetRef kind '${targetKind}'`);
        continue;
      }

      if (!workloads.has(workloadKey(ns, targetKind, targetName))) {
        invalid.push(`${ns}/${name}: target ${targetKind}/${targetName} not found`);
      }

      if (!VALID_UPDATE_MODES.has(updateMode)) {
        invalid.push(`${ns}/${name}: invalid updateMode '${updateMode}'`);
      }

      if (updateMode === 'Off') {
        recommendationOnly++;
      }
      validCount++;
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
            ? `VPA misconfigurations detected: ${invalid.join('; ')}`
            : `${invalid.length} VPA misconfigurations detected: ${invalid.slice(0, 3).join('; ')}...`,
        remediation: REMEDIATION,
      };
    }

    if (validCount > 0 && recommendationOnly === validCount) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.PerformanceEfficiency,
        status: CheckStatus.Warning,
        severity: Severity.Low,
        message: 'All VPAs are in recommendation mode (updateMode=Off). Consider enabling updates where safe.',
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.PerformanceEfficiency,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message: `VPA configs are sane. Checked ${validCount} in-scope VPA object(s).`,
      remediation: REMEDIATION,
    };
  },
};
