/**
 * Operational Excellence: kube9-operator structured logging configuration
 *
 * Ensures the workload exposes LOG_LEVEL consistent with Winston JSON logging
 * in src/logging/logger.ts so operators can tune verbosity for investigations.
 */

import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  getContainerEnv,
  getOperatorContainer,
  isKube9OperatorDeployment,
  normalizedLogLevel,
  VALID_LOG_LEVELS,
} from './kube9-operator-shared.js';

const CHECK_ID = 'operational-excellence.kube9-operator-logging-configuration';
const CHECK_NAME = 'kube9-operator logging configuration';

const REMEDIATION =
  'Set LOG_LEVEL on the operator container to one of error, warn, info, or debug (Helm value logLevel). The operator emits JSON logs to stdout; see src/logging/logger.ts and charts/kube9-operator/templates/deployment.yaml.';

export const kube9OperatorLoggingConfigurationCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.OperationalExcellence,
  description:
    'Validates kube9-operator Deployments declare a supported LOG_LEVEL for structured logging.',
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
          'Deploy kube9-operator with the standard chart labels so this check can validate logging configuration.',
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

      const logEnv = getContainerEnv(container, 'LOG_LEVEL');
      const raw = logEnv?.value;
      const level = normalizedLogLevel(raw);

      if (level === undefined) {
        failures.push(
          `${ref} container ${cname}: LOG_LEVEL must be set (literal env) so log verbosity is explicit for operators and log pipelines`
        );
        continue;
      }

      if (!VALID_LOG_LEVELS.has(level)) {
        failures.push(
          `${ref} container ${cname}: LOG_LEVEL must be one of error, warn, info, debug; got ${String(raw)}`
        );
        continue;
      }

      if (level === 'debug') {
        warnings.push(
          `${ref} container ${cname}: LOG_LEVEL is debug; consider info or warn in production to reduce noise and sensitive detail in logs`
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
      message: `kube9-operator logging: ${deployments.length} Deployment(s) declare a supported LOG_LEVEL`,
      remediation: REMEDIATION,
    };
  },
};
