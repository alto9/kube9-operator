/**
 * Operational Excellence: kube9-operator metrics exposure readiness
 *
 * Ensures probe ports are declared on the container so the Prometheus /metrics
 * endpoint (same HTTP listener as /healthz) is discoverable for scraping.
 */

import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  containerDeclaresProbePort,
  getOperatorContainer,
  isKube9OperatorDeployment,
} from './kube9-operator-shared.js';

const CHECK_ID = 'operational-excellence.kube9-operator-metrics-exposure';
const CHECK_NAME = 'kube9-operator metrics exposure';

const REMEDIATION =
  'Declare containerPorts on the operator container for the HTTP listener used by liveness/readiness (e.g. name http, containerPort 8080) so monitoring can target the same port as /metrics. Add Service and PodMonitor/ServiceMonitor or prometheus.io/* annotations as needed for your stack.';

export const kube9OperatorMetricsExposureCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.OperationalExcellence,
  description:
    'Validates kube9-operator containerPorts include the liveness/readiness HTTP port (shared with /metrics).',
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
          'Deploy kube9-operator with the standard chart labels so this check can validate metrics port exposure.',
      };
    }

    const warnings: string[] = [];
    const failures: string[] = [];

    for (const d of deployments) {
      const ns = d.metadata?.namespace ?? 'default';
      const depName = d.metadata?.name ?? 'unknown';
      const ref = `${ns}/${depName}`;
      const container = getOperatorContainer(d.spec?.template?.spec);
      if (!container) {
        failures.push(`${ref}: no containers in pod template`);
        continue;
      }
      const cname = container.name ?? 'unknown';

      const liv = container.livenessProbe?.httpGet;
      const ready = container.readinessProbe?.httpGet;

      if (!liv || !ready) {
        failures.push(
          `${ref} container ${cname}: liveness and readiness httpGet probes required before metrics port alignment can be validated`
        );
        continue;
      }

      if (!containerDeclaresProbePort(liv, container)) {
        failures.push(
          `${ref} container ${cname}: containerPorts must include the liveness httpGet port (required for documenting the /metrics listener)`
        );
      }
      if (!containerDeclaresProbePort(ready, container)) {
        failures.push(
          `${ref} container ${cname}: containerPorts must include the readiness httpGet port`
        );
      }

      const annotations = d.spec?.template?.metadata?.annotations ?? {};
      if (annotations['prometheus.io/scrape'] === 'false') {
        warnings.push(
          `${ref}: prometheus.io/scrape is false; Prometheus may not scrape kube9-operator metrics from pod annotations`
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
      message: `kube9-operator metrics: ${deployments.length} Deployment(s) declare containerPorts aligned with HTTP probes`,
      remediation: REMEDIATION,
    };
  },
};
