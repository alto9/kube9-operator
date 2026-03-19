/**
 * Security check: Detect secrets stored in ConfigMaps.
 *
 * ConfigMaps are not suitable for sensitive data. This check flags ConfigMaps
 * that contain keys/values resembling secrets (e.g. password, token, api_key).
 */

import type { V1ConfigMap } from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  isSensitiveKey,
  looksLikeSecretValue,
  base64LooksLikeSecret,
} from './heuristics.js';

const REMEDIATION =
  'Move secrets to Kubernetes Secrets or external-secrets; avoid storing secrets in ConfigMaps.';

function getConfigMapItems(response: { body?: { items?: V1ConfigMap[] }; items?: V1ConfigMap[] }): V1ConfigMap[] {
  return response.body?.items ?? response.items ?? [];
}

function configMapHasSecrets(cm: V1ConfigMap): boolean {
  const ns = cm.metadata?.namespace ?? '';
  const name = cm.metadata?.name ?? '';

  if (cm.data) {
    for (const [key, value] of Object.entries(cm.data)) {
      if (typeof value !== 'string') continue;
      if (isSensitiveKey(key) && looksLikeSecretValue(value)) {
        return true;
      }
    }
  }

  if (cm.binaryData) {
    for (const [key, value] of Object.entries(cm.binaryData)) {
      if (typeof value !== 'string') continue;
      if (isSensitiveKey(key) && base64LooksLikeSecret(value)) {
        return true;
      }
    }
  }

  return false;
}

export const secretsInConfigMapsCheck: AssessmentCheck = {
  id: 'security.secrets-in-configmaps',
  name: 'Secrets in ConfigMaps',
  pillar: Pillar.Security,
  description: 'Detects ConfigMaps containing likely secret data (passwords, tokens, etc.)',
  defaultSeverity: Severity.High,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const response = await ctx.kubernetes.coreApi.listConfigMapForAllNamespaces();
    const items = getConfigMapItems(response as { body?: { items?: V1ConfigMap[] }; items?: V1ConfigMap[] });

    const violations: string[] = [];
    for (const cm of items) {
      if (configMapHasSecrets(cm)) {
        const ns = cm.metadata?.namespace ?? 'default';
        const name = cm.metadata?.name ?? 'unknown';
        violations.push(`${ns}/${name}`);
      }
    }

    if (violations.length > 0) {
      return {
        checkId: 'security.secrets-in-configmaps',
        checkName: 'Secrets in ConfigMaps',
        pillar: Pillar.Security,
        status: CheckStatus.Failing,
        severity: Severity.High,
        objectKind: 'ConfigMap',
        message: `Found ${violations.length} ConfigMap(s) with likely secret data: ${violations.join(', ')}`,
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: 'security.secrets-in-configmaps',
      checkName: 'Secrets in ConfigMaps',
      pillar: Pillar.Security,
      status: CheckStatus.Passing,
      message: 'No ConfigMaps with likely secret data found.',
      remediation: REMEDIATION,
    };
  },
};
