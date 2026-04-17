/**
 * Operational Excellence: kube9-operator health probes
 *
 * Validates that kube9-operator Deployments expose the baseline HTTP liveness
 * and readiness endpoints expected by the operator health server contract.
 */

import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  getOperatorContainer,
  isKube9OperatorDeployment,
  probeHttpPortValue,
} from './kube9-operator-shared.js';

const CHECK_ID = 'operational-excellence.kube9-operator-health-probes';
const CHECK_NAME = 'kube9-operator health probes';
const EXPECTED_LIVENESS_PATH = '/healthz';
const EXPECTED_READINESS_PATH = '/readyz';

const REMEDIATION =
  'Configure the operator Deployment pod template so the main container defines livenessProbe and readinessProbe with httpGet path /healthz and /readyz on the HTTP port (default 8080), matching src/health/server.ts. See charts/kube9-operator/templates/deployment.yaml for reference.';

export const kube9OperatorHealthProbesCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.OperationalExcellence,
  description:
    'Validates kube9-operator Deployments use /healthz and /readyz HTTP probes on the main container.',
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
          'Deploy kube9-operator with the standard chart labels so this check can validate health probe configuration.',
      };
    }

    const problems: string[] = [];

    for (const d of deployments) {
      const ns = d.metadata?.namespace ?? 'default';
      const name = d.metadata?.name ?? 'unknown';
      const ref = `${ns}/${name}`;
      const container = getOperatorContainer(d.spec?.template?.spec);
      if (!container) {
        problems.push(`${ref}: no containers in pod template`);
        continue;
      }
      const cname = container.name ?? 'unknown';

      const liv = container.livenessProbe;
      const ready = container.readinessProbe;
      if (!liv?.httpGet) {
        problems.push(
          `${ref} container ${cname}: livenessProbe must use httpGet (expected path ${EXPECTED_LIVENESS_PATH})`
        );
      } else if (liv.httpGet.path !== EXPECTED_LIVENESS_PATH) {
        problems.push(
          `${ref} container ${cname}: liveness httpGet.path must be ${EXPECTED_LIVENESS_PATH}, got ${String(liv.httpGet.path)}`
        );
      }

      if (!ready?.httpGet) {
        problems.push(
          `${ref} container ${cname}: readinessProbe must use httpGet (expected path ${EXPECTED_READINESS_PATH})`
        );
      } else if (ready.httpGet.path !== EXPECTED_READINESS_PATH) {
        problems.push(
          `${ref} container ${cname}: readiness httpGet.path must be ${EXPECTED_READINESS_PATH}, got ${String(ready.httpGet.path)}`
        );
      }

      if (liv?.httpGet && ready?.httpGet) {
        const lp = probeHttpPortValue(liv.httpGet.port);
        const rp = probeHttpPortValue(ready.httpGet.port);
        if (lp !== undefined && rp !== undefined && String(lp) !== String(rp)) {
          problems.push(
            `${ref} container ${cname}: liveness and readiness probes should target the same HTTP port (health and metrics share one listener)`
          );
        }
      }
    }

    if (problems.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: `kube9-operator observability: ${deployments.length} Deployment(s) have compliant /healthz and /readyz probes`,
        remediation: REMEDIATION,
      };
    }

    const message =
      problems.length <= 5
        ? problems.join('; ')
        : `${problems.length} issue(s): ${problems.slice(0, 3).join('; ')}...`;

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
  },
};
