/**
 * Security Check: Capabilities Validation
 *
 * Validates that containers do not add dangerous capabilities without dropping ALL.
 * Dangerous capabilities can lead to privilege escalation.
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'security.capabilities-validation';
const CHECK_NAME = 'Capabilities Validation';
const REMEDIATION =
  'Drop ALL capabilities and add only required ones; avoid SYS_ADMIN, SYS_MODULE, etc.';

/** Dangerous capabilities that should not be added without drop: ['ALL'] */
const DANGEROUS_CAPABILITIES = new Set([
  'SYS_ADMIN',
  'SYS_MODULE',
  'SYS_PTRACE',
  'SYS_RAWIO',
  'NET_ADMIN',
  'DAC_READ_SEARCH',
  'AUDIT_CONTROL',
  'MKNOD',
  'SYS_BOOT',
  'SYS_TIME',
]);

function normalizeCapability(cap: string): string {
  return cap.replace(/^CAP_/i, '').toUpperCase();
}

function hasDangerousCapability(capabilities: k8s.V1Capabilities | undefined): {
  hasDangerous: boolean;
  dangerous: string[];
} {
  const dangerous: string[] = [];
  const add = capabilities?.add ?? [];

  for (const cap of add) {
    const normalized = normalizeCapability(cap);
    if (DANGEROUS_CAPABILITIES.has(normalized)) {
      dangerous.push(cap);
    }
  }

  const drop = capabilities?.drop ?? [];
  const dropsAll =
    drop.some((c) => normalizeCapability(c) === 'ALL') || drop.length >= 39;

  if (dangerous.length === 0) {
    return { hasDangerous: false, dangerous: [] };
  }
  if (dropsAll) {
    return { hasDangerous: false, dangerous: [] };
  }
  return { hasDangerous: true, dangerous };
}

export const capabilitiesValidationCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Security,
  description: 'Validates that dangerous capabilities are not added without drop ALL',
  defaultSeverity: Severity.High,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const response = await ctx.kubernetes.coreApi.listPodForAllNamespaces();
    const items = response.items ?? [];

    const violations: string[] = [];
    for (const pod of items) {
      const ns = pod.metadata?.namespace ?? '';
      const podName = pod.metadata?.name ?? 'unknown';
      const containers = pod.spec?.containers ?? [];

      for (const container of containers) {
        const { hasDangerous, dangerous } = hasDangerousCapability(
          container.securityContext?.capabilities
        );
        if (hasDangerous) {
          violations.push(
            `${ns}/${podName}/${container.name ?? 'unknown'}: ${dangerous.join(', ')}`
          );
        }
      }
    }

    if (violations.length === 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Security,
        status: CheckStatus.Passing,
        severity: Severity.High,
        message: 'No dangerous capabilities found without drop ALL',
        remediation: REMEDIATION,
      };
    }

    const message =
      violations.length <= 5
        ? `Dangerous capabilities: ${violations.join('; ')}`
        : `${violations.length} violations: ${violations.slice(0, 2).join('; ')}...`;

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
