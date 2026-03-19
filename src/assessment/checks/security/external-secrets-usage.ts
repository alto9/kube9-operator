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
      const statusCode = (err as { response?: { statusCode?: number } })?.response?.statusCode;
      if (statusCode === 404) {
        return {
          checkId: 'security.external-secrets-usage',
          checkName: 'External Secrets Usage',
          pillar: Pillar.Security,
          status: CheckStatus.Warning,
          severity: Severity.Medium,
          message:
            'external-secrets operator not detected. Consider using it for secure secret management.',
          remediation: REMEDIATION,
        };
      }
      throw err;
    }
  },
};
