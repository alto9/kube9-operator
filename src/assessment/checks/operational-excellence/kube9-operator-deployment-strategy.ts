/**
 * Operational Excellence: kube9-operator deployment strategy
 *
 * Evaluates rollout strategy and disruption settings on kube9-operator Deployments
 * to flag configurations that increase outage risk during releases.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { isKube9OperatorDeployment } from './kube9-operator-shared.js';

const CHECK_ID = 'operational-excellence.kube9-operator-deployment-strategy';
const CHECK_NAME = 'kube9-operator deployment strategy';

const REMEDIATION =
  'For HA (replicas >= 2), avoid Recreate (it terminates all pods before new ones run). Prefer RollingUpdate with bounded maxUnavailable (below replica count) and non-zero maxSurge when possible. Set spec.progressDeadlineSeconds high enough for image pulls and startup (often 300–600s). Single-replica Recreate is acceptable when a volume or startup constraint requires it. See charts/kube9-operator/templates/deployment.yaml and Kubernetes Deployment strategy documentation.';

/** Kubernetes defaults when rollingUpdate fields are omitted */
const DEFAULT_MAX_UNAVAILABLE_PCT = 25;
const PROGRESS_DEADLINE_WARN_BELOW_SEC = 120;

type ParsedIntOrPercent = { kind: 'int'; value: number } | { kind: 'percent'; value: number };

function parseIntOrString(v: k8s.IntOrString | undefined | null): ParsedIntOrPercent | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return { kind: 'int', value: Math.max(0, Math.trunc(v)) };
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.endsWith('%')) {
      const n = Number.parseInt(s.slice(0, -1), 10);
      if (Number.isNaN(n)) return undefined;
      return { kind: 'percent', value: n };
    }
    const n = Number.parseInt(s, 10);
    if (Number.isNaN(n)) return undefined;
    return { kind: 'int', value: Math.max(0, n) };
  }
  return undefined;
}

function replicaCount(spec: k8s.V1DeploymentSpec | undefined): number {
  const r = spec?.replicas;
  if (typeof r === 'number' && r >= 1) {
    return r;
  }
  return 1;
}

function strategyIsRecreate(spec: k8s.V1DeploymentSpec | undefined): boolean {
  return spec?.strategy?.type === 'Recreate';
}

/**
 * Effective max unavailable pods for RollingUpdate (Kubernetes percentage rounds down).
 * When rollingUpdate or maxUnavailable is omitted, defaults match the API (25%).
 */
function effectiveMaxUnavailablePods(replicas: number, ru: k8s.V1RollingUpdateDeployment | undefined): number {
  const parsed =
    parseIntOrString(ru?.maxUnavailable) ?? ({ kind: 'percent', value: DEFAULT_MAX_UNAVAILABLE_PCT } as const);
  if (parsed.kind === 'int') {
    return Math.min(parsed.value, replicas);
  }
  return Math.floor((replicas * parsed.value) / 100);
}

export const kube9OperatorDeploymentStrategyCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.OperationalExcellence,
  description:
    'Validates kube9-operator Deployment rollout strategy and disruption settings for safer releases.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const res = await ctx.kubernetes.appsApi.listDeploymentForAllNamespaces();
    const deployments = (res.items ?? []).filter(isKube9OperatorDeployment);

    if (deployments.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Skipped,
        severity: Severity.Info,
        message:
          'No kube9-operator Deployment found (label app.kubernetes.io/name=kube9-operator).',
        remediation:
          'Deploy kube9-operator with the standard chart labels so this check can validate deployment strategy.',
      };
    }

    const failures: string[] = [];
    const warnings: string[] = [];

    for (const d of deployments) {
      const ns = d.metadata?.namespace ?? 'default';
      const depName = d.metadata?.name ?? 'unknown';
      const ref = `${ns}/${depName}`;
      const spec = d.spec;
      const replicas = replicaCount(spec);

      if (strategyIsRecreate(spec)) {
        if (replicas >= 2) {
          failures.push(
            `${ref}: strategy Recreate with ${replicas} replicas stops all pods before new ones run, causing a full outage during rollouts`
          );
        }
      } else {
        const ru = spec?.strategy?.rollingUpdate;
        if (replicas >= 2) {
          const mu = effectiveMaxUnavailablePods(replicas, ru);
          if (mu >= replicas) {
            failures.push(
              `${ref}: RollingUpdate maxUnavailable allows ${mu} of ${replicas} pods to be unavailable at once, so the Service can lose all ready endpoints during a rollout`
            );
          }
        }
      }

      const pds = spec?.progressDeadlineSeconds;
      if (typeof pds === 'number' && pds > 0 && pds < PROGRESS_DEADLINE_WARN_BELOW_SEC) {
        warnings.push(
          `${ref}: progressDeadlineSeconds is ${pds}s; if rollouts fail with ProgressDeadlineExceeded, increase to at least ${PROGRESS_DEADLINE_WARN_BELOW_SEC}s (or remove for the default 600s)`
        );
      }
    }

    if (failures.length > 0) {
      const message =
        failures.length <= 5
          ? failures.join('; ')
          : `${failures.length} issue(s): ${failures.slice(0, 3).join('; ')}...`;
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Failing,
        severity: Severity.High,
        objectKind: 'Deployment',
        message,
        remediation: REMEDIATION,
      };
    }

    if (warnings.length > 0) {
      const message =
        warnings.length <= 4
          ? warnings.join('; ')
          : `${warnings.length} notice(s): ${warnings.slice(0, 2).join('; ')}...`;
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Warning,
        severity: Severity.Low,
        objectKind: 'Deployment',
        message,
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.OperationalExcellence,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message: `kube9-operator rollout: ${deployments.length} Deployment(s) use an acceptable strategy and disruption settings`,
      remediation: REMEDIATION,
    };
  },
};
