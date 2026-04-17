/**
 * Operational Excellence: kube9-operator audit and correlation signals
 *
 * Validates downward API and workload identity signals that support log correlation
 * and Kubernetes API audit attribution (namespace context and non-default identity).
 */

import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  getContainerEnv,
  getOperatorContainer,
  isKube9OperatorDeployment,
  isPodNamespaceFieldRef,
} from './kube9-operator-shared.js';

const CHECK_ID = 'operational-excellence.kube9-operator-audit-signals';
const CHECK_NAME = 'kube9-operator audit signals';

const REMEDIATION =
  'Inject POD_NAMESPACE via the downward API (valueFrom.fieldRef fieldPath metadata.namespace) and run the operator under a dedicated ServiceAccount (not default). For cluster-level API audit evidence, enable and retain a Kubernetes Audit Policy appropriate to your compliance needs. See charts/kube9-operator/templates/deployment.yaml and Kubernetes documentation on auditing.';

export const kube9OperatorAuditSignalsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.OperationalExcellence,
  description:
    'Validates POD_NAMESPACE downward API injection and a dedicated ServiceAccount for the kube9-operator workload.',
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
          'Deploy kube9-operator with the standard chart labels so this check can validate audit correlation signals.',
      };
    }

    const failures: string[] = [];

    for (const d of deployments) {
      const ns = d.metadata?.namespace ?? 'default';
      const depName = d.metadata?.name ?? 'unknown';
      const ref = `${ns}/${depName}`;
      const podSpec = d.spec?.template?.spec;
      const container = getOperatorContainer(podSpec);
      if (!container) {
        failures.push(`${ref}: no containers in pod template`);
        continue;
      }
      const cname = container.name ?? 'unknown';

      const podNsEnv = getContainerEnv(container, 'POD_NAMESPACE');
      if (!isPodNamespaceFieldRef(podNsEnv)) {
        failures.push(
          `${ref} container ${cname}: POD_NAMESPACE must be set from valueFrom.fieldRef fieldPath metadata.namespace for log and event correlation`
        );
      }

      const sa =
        podSpec?.serviceAccountName?.trim() ||
        (podSpec as { serviceAccount?: string } | undefined)?.serviceAccount?.trim();
      if (!sa || sa === 'default') {
        failures.push(
          `${ref}: use a dedicated ServiceAccount for the operator workload so Kubernetes API audit logs identify kube9-operator activity distinctly from other default-SA workloads`
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

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.OperationalExcellence,
      status: CheckStatus.Passing,
      severity: Severity.Medium,
      message: `kube9-operator audit signals: ${deployments.length} Deployment(s) inject POD_NAMESPACE and use a dedicated ServiceAccount`,
      remediation: REMEDIATION,
    };
  },
};
