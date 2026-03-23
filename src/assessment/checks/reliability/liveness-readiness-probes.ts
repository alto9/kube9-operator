/**
 * Reliability Check: Liveness and Readiness Probes
 *
 * Validates that liveness and readiness probes are configured for workloads
 * where expected (Deployment, StatefulSet, DaemonSet). Excludes Jobs/CronJobs.
 * Flags missing probes, obviously broken probe settings (e.g. identical
 * liveness/readiness with zero grace where dangerous), and basic probe misuse
 * (httpGet without path, tcpSocket without port, exec without command).
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  isProbeCheckRelevant,
  type WorkloadMetadata,
} from './heuristics.js';

const CHECK_ID = 'reliability.liveness-readiness-probes';
const CHECK_NAME = 'Liveness and Readiness Probes';
const REMEDIATION_MISSING =
  'Add livenessProbe and readinessProbe to container spec. Use httpGet, tcpSocket, or exec. Prefer httpGet with a dedicated /health path. Or label workload with kube9.io/probe-exempt=true';
const REMEDIATION_BROKEN =
  'Ensure probes differ appropriately: use startupProbe for slow starters, set initialDelaySeconds for liveness to avoid premature restarts. Avoid identical liveness/readiness with no grace period.';
const REMEDIATION_MISCONFIGURED =
  'Fix probe config: httpGet requires path and port; tcpSocket requires port; exec requires command array.';

interface ProbeViolation {
  workload: string;
  container: string;
  type: 'missing-liveness' | 'missing-readiness' | 'both-missing' | 'identical-dangerous' | 'misconfigured';
  detail?: string;
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

function hasProbe(probe: k8s.V1Probe | undefined): boolean {
  if (!probe) return false;
  return !!(probe.httpGet || probe.tcpSocket || probe.exec || probe.grpc);
}

/** Basic validation: httpGet needs path+port, tcpSocket needs port, exec needs command, grpc needs port */
function isProbeMisconfigured(probe: k8s.V1Probe): string | null {
  if (probe.httpGet) {
    const port = probe.httpGet?.port;
    const path = probe.httpGet?.path;
    if (port === undefined || port === null) return 'httpGet missing port';
    if (!path || String(path).trim() === '') return 'httpGet missing path';
  }
  if (probe.tcpSocket) {
    const port = probe.tcpSocket?.port;
    if (port === undefined || port === null) return 'tcpSocket missing port';
  }
  if (probe.exec) {
    const cmd = probe.exec?.command;
    if (!cmd || !Array.isArray(cmd) || cmd.length === 0) return 'exec missing command';
  }
  if (probe.grpc) {
    const port = probe.grpc?.port;
    if (port === undefined || port === null) return 'grpc missing port';
  }
  return null;
}

/** Serialize probe for equality check (type + key params) */
function probeSignature(probe: k8s.V1Probe): string {
  const p = JSON.stringify({
    httpGet: probe.httpGet ? { path: probe.httpGet.path, port: probe.httpGet.port } : undefined,
    tcpSocket: probe.tcpSocket ? { port: probe.tcpSocket.port } : undefined,
    exec: probe.exec ? { command: probe.exec.command } : undefined,
    grpc: probe.grpc ? { port: probe.grpc.port } : undefined,
    initialDelaySeconds: probe.initialDelaySeconds,
    periodSeconds: probe.periodSeconds,
  });
  return p;
}

/** Check if liveness and readiness are identical with no/very low initialDelaySeconds (dangerous) */
function isIdenticalAndDangerous(
  liveness: k8s.V1Probe,
  readiness: k8s.V1Probe
): boolean {
  if (probeSignature(liveness) !== probeSignature(readiness)) return false;
  const delay = liveness.initialDelaySeconds ?? 0;
  return delay <= 1;
}

function collectViolations(
  workload: string,
  template: k8s.V1PodTemplateSpec | undefined
): ProbeViolation[] {
  const violations: ProbeViolation[] = [];
  const containers = template?.spec?.containers ?? [];

  for (const c of containers) {
    const name = c.name ?? 'unknown';
    const liveness = c.livenessProbe;
    const readiness = c.readinessProbe;
    const hasL = hasProbe(liveness);
    const hasR = hasProbe(readiness);

    if (!hasL && !hasR) {
      violations.push({ workload, container: name, type: 'both-missing' });
      continue;
    }
    if (!hasL) {
      violations.push({ workload, container: name, type: 'missing-liveness' });
    }
    if (!hasR) {
      violations.push({ workload, container: name, type: 'missing-readiness' });
    }

    if (hasL) {
      const mis = isProbeMisconfigured(liveness!);
      if (mis) {
        violations.push({
          workload,
          container: name,
          type: 'misconfigured',
          detail: `liveness: ${mis}`,
        });
      }
    }
    if (hasR) {
      const mis = isProbeMisconfigured(readiness!);
      if (mis) {
        violations.push({
          workload,
          container: name,
          type: 'misconfigured',
          detail: `readiness: ${mis}`,
        });
      }
    }

    if (hasL && hasR && liveness! && readiness!) {
      if (isIdenticalAndDangerous(liveness, readiness)) {
        violations.push({
          workload,
          container: name,
          type: 'identical-dangerous',
          detail: 'identical liveness and readiness with no/very low initialDelaySeconds can cause premature restarts',
        });
      }
    }
  }
  return violations;
}

export const livenessReadinessProbesCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description:
    'Validates liveness and readiness probes on Deployments, StatefulSets, DaemonSets. Excludes Jobs/CronJobs.',
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

    const allViolations: ProbeViolation[] = [];

    for (const d of deployments) {
      const meta = toWorkloadMeta(d.metadata, 'Deployment');
      if (!isProbeCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (Deployment)`;
      allViolations.push(...collectViolations(workload, d.spec?.template));
    }

    for (const s of statefulSets) {
      const meta = toWorkloadMeta(s.metadata, 'StatefulSet');
      if (!isProbeCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (StatefulSet)`;
      allViolations.push(...collectViolations(workload, s.spec?.template));
    }

    for (const ds of daemonSets) {
      const meta = toWorkloadMeta(ds.metadata, 'DaemonSet');
      if (!isProbeCheckRelevant(meta)) continue;
      const workload = `${meta.namespace}/${meta.name} (DaemonSet)`;
      allViolations.push(...collectViolations(workload, ds.spec?.template));
    }

    if (allViolations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Reliability,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: 'All workloads in scope have valid liveness and readiness probes',
        remediation: REMEDIATION_MISSING,
      };
    }

    const fmtViolation = (v: ProbeViolation) =>
      v.detail
        ? `${v.workload} container ${v.container}: ${v.type} - ${v.detail}`
        : `${v.workload} container ${v.container}: ${v.type}`;

    const message =
      allViolations.length <= 5
        ? allViolations.map(fmtViolation).join('; ')
        : `${allViolations.length} probe issues: ${allViolations.slice(0, 3).map(fmtViolation).join('; ')}...`;

    const hasDangerous = allViolations.some((v) => v.type === 'identical-dangerous');
    const hasMisconfigured = allViolations.some((v) => v.type === 'misconfigured');
    let remediation = REMEDIATION_MISSING;
    if (hasDangerous || hasMisconfigured) {
      remediation = [REMEDIATION_BROKEN, REMEDIATION_MISCONFIGURED, REMEDIATION_MISSING].join(' ');
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Reliability,
      status: CheckStatus.Failing,
      severity: Severity.Medium,
      objectKind: 'Deployment',
      message,
      remediation,
    };
  },
};
