/**
 * Security check: Detect external-secrets operator usage.
 *
 * external-secrets provides secure secret management from external stores
 * (Vault, AWS Secrets Manager, etc.). This check verifies the operator is
 * installed by detecting the ExternalSecret CRD.
 */

import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const EXTERNAL_SECRETS_CRD = 'externalsecrets.external-secrets.io';
const REMEDIATION =
  'Consider installing external-secrets operator for secure secret management from Vault, AWS Secrets Manager, etc.';

function isNotFoundError(err: unknown): boolean {
  const error = err as {
    response?: { statusCode?: number; body?: { reason?: string } };
    statusCode?: number;
    body?: { reason?: string };
    message?: string;
  };

  const statusCode = error.response?.statusCode ?? error.statusCode;
  if (statusCode === 404) {
    return true;
  }

  const reason = error.response?.body?.reason ?? error.body?.reason;
  if (reason === 'NotFound') {
    return true;
  }

  const message = error.message ?? (err instanceof Error ? err.message : String(err));
  return message.includes('NotFound') || message.includes('not found') || message.includes('HTTP-Code: 404');
}

export const externalSecretsUsageCheck: AssessmentCheck = {
  id: 'security.external-secrets-usage',
  name: 'External Secrets Usage',
  pillar: Pillar.Security,
  description: 'Detects whether external-secrets operator is installed for secret management',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    try {
      await ctx.kubernetes.apiextensionsApi.readCustomResourceDefinition({
        name: EXTERNAL_SECRETS_CRD,
      });

      return {
        checkId: 'security.external-secrets-usage',
        checkName: 'External Secrets Usage',
        pillar: Pillar.Security,
        status: CheckStatus.Passing,
        message: 'external-secrets operator is installed (ExternalSecret CRD detected).',
        remediation: REMEDIATION,
      };
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        return {
          checkId: 'security.external-secrets-usage',
          checkName: 'External Secrets Usage',
          pillar: Pillar.Security,
          status: CheckStatus.Skipped,
          severity: Severity.Low,
          message:
            'external-secrets CRD not detected; skipping check in this cluster.',
          remediation: REMEDIATION,
        };
      }
      throw err;
    }
  },
};
