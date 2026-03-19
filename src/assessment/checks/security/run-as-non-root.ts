/**
 * Security Check: Run as Non-Root
 *
 * Validates that pods and containers have runAsNonRoot: true set.
 * Fails if runAsNonRoot is false or missing at pod or container level.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'security.run-as-non-root';
const CHECK_NAME = 'Run as Non-Root';
const REMEDIATION =
  'Set runAsNonRoot: true and runAsUser to a non-zero UID in pod and container securityContext';

function isRunAsNonRootCompliant(
  pod: k8s.V1Pod
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  const ns = pod.metadata?.namespace ?? '';
  const podName = pod.metadata?.name ?? 'unknown';

  const podRunAsNonRoot = pod.spec?.securityContext?.runAsNonRoot;
  const containers = [
    ...(pod.spec?.containers ?? []),
    ...(pod.spec?.initContainers ?? []),
    ...(pod.spec?.ephemeralContainers ?? []),
  ];

  for (const container of containers) {
    const containerRunAsNonRoot = container.securityContext?.runAsNonRoot;
    const effectiveRunAsNonRoot = containerRunAsNonRoot ?? podRunAsNonRoot;

    if (effectiveRunAsNonRoot === false) {
      violations.push(`${ns}/${podName}/${container.name ?? 'unknown'}`);
    } else if (effectiveRunAsNonRoot === undefined) {
      violations.push(`${ns}/${podName}/${container.name ?? 'unknown'}`);
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

export const runAsNonRootCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Security,
  description: 'Validates that pods and containers run as non-root',
  defaultSeverity: Severity.High,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const response = await ctx.kubernetes.coreApi.listPodForAllNamespaces();
    const items = response.items ?? [];

    const allViolations: string[] = [];
    for (const pod of items) {
      const { violations } = isRunAsNonRootCompliant(pod);
      allViolations.push(...violations);
    }

    if (allViolations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Security,
        status: CheckStatus.Passing,
        severity: Severity.High,
        message: 'All pods and containers run as non-root',
        remediation: REMEDIATION,
      };
    }

    const message =
      allViolations.length <= 5
        ? `Pods/containers not running as non-root: ${allViolations.join(', ')}`
        : `${allViolations.length} pods/containers not running as non-root: ${allViolations.slice(0, 3).join(', ')}...`;

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Security,
      status: CheckStatus.Failing,
      severity: Severity.High,
      objectKind: 'Pod',
      message,
      remediation: REMEDIATION,
    };
  },
};
