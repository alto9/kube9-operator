/**
 * Security Check: Privileged Containers
 *
 * Validates that no containers run with privileged: true.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'security.privileged-containers';
const CHECK_NAME = 'No Privileged Containers';
const REMEDIATION = 'Remove privileged: true; run with least privilege';

export const privilegedContainersCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Security,
  description: 'Validates that no containers run in privileged mode',
  defaultSeverity: Severity.Critical,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const response = await ctx.kubernetes.coreApi.listPodForAllNamespaces();
    const items = response.items ?? [];

    const violations: string[] = [];
    for (const pod of items) {
      const ns = pod.metadata?.namespace ?? '';
      const podName = pod.metadata?.name ?? 'unknown';
      const containers = pod.spec?.containers ?? [];

      for (const container of containers) {
        if (container.securityContext?.privileged === true) {
          violations.push(`${ns}/${podName}/${container.name ?? 'unknown'}`);
        }
      }
    }

    if (violations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Security,
        status: CheckStatus.Passing,
        severity: Severity.Critical,
        message: 'No privileged containers found',
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `Privileged containers: ${violations.join(', ')}`
        : `${violations.length} privileged containers: ${violations.slice(0, 3).join(', ')}...`;

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Security,
      status: CheckStatus.Failing,
      severity: Severity.Critical,
      objectKind: 'Pod',
      message,
      remediation: REMEDIATION,
    };
  },
};
