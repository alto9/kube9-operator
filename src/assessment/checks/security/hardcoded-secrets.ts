/**
 * Security check: Detect hardcoded secrets in workload env vars.
 *
 * Scans Deployments and StatefulSets for env vars with `value:` (not valueFrom)
 * that look like secrets (e.g. password=..., token=...).
 */

import type { V1Deployment, V1StatefulSet, V1EnvVar } from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import { looksLikeHardcodedSecret } from './heuristics.js';

const REMEDIATION =
  'Use Secrets, external-secrets, or valueFrom.secretKeyRef instead of hardcoded env values.';

function getItems<T>(response: { body?: { items?: T[] }; items?: T[] }): T[] {
  return response.body?.items ?? response.items ?? [];
}

interface Violation {
  namespace: string;
  workload: string;
  kind: string;
  container: string;
}

function scanWorkloadEnv(
  workload: { metadata?: { namespace?: string; name?: string }; spec?: { template?: { spec?: { containers?: Array<{ name?: string; env?: V1EnvVar[] }> } } } },
  kind: string,
  violations: Violation[]
): void {
  const ns = workload.metadata?.namespace ?? 'default';
  const name = workload.metadata?.name ?? 'unknown';
  const containers = workload.spec?.template?.spec?.containers ?? [];

  for (const container of containers) {
    const containerName = container.name ?? 'unknown';
    const envVars = container.env ?? [];

    for (const env of envVars) {
      if (env.value !== undefined && env.value !== null && env.name) {
        if (looksLikeHardcodedSecret(env.name, String(env.value))) {
          violations.push({ namespace: ns, workload: name, kind, container: containerName });
          break; // One violation per container is enough
        }
      }
    }
  }
}

export const hardcodedSecretsCheck: AssessmentCheck = {
  id: 'security.hardcoded-secrets',
  name: 'Hardcoded Secrets in Workloads',
  pillar: Pillar.Security,
  description: 'Detects hardcoded secrets in Deployment/StatefulSet env vars',
  defaultSeverity: Severity.High,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const violations: Violation[] = [];

    const deploymentResponse = await ctx.kubernetes.appsApi.listDeploymentForAllNamespaces();
    const deployments = getItems<V1Deployment>(deploymentResponse as { body?: { items?: V1Deployment[] }; items?: V1Deployment[] });

    for (const d of deployments) {
      scanWorkloadEnv(d, 'Deployment', violations);
    }

    const statefulSetResponse = await ctx.kubernetes.appsApi.listStatefulSetForAllNamespaces();
    const statefulSets = getItems<V1StatefulSet>(statefulSetResponse as { body?: { items?: V1StatefulSet[] }; items?: V1StatefulSet[] });

    for (const s of statefulSets) {
      scanWorkloadEnv(s, 'StatefulSet', violations);
    }

    if (violations.length > 0) {
      const summary = violations
        .map((v) => `${v.namespace}/${v.workload} (${v.container})`)
        .join(', ');

      const firstKind = violations[0]?.kind ?? 'Deployment';

      return {
        checkId: 'security.hardcoded-secrets',
        checkName: 'Hardcoded Secrets in Workloads',
        pillar: Pillar.Security,
        status: CheckStatus.Failing,
        severity: Severity.High,
        objectKind: firstKind,
        message: `Found ${violations.length} workload(s) with likely hardcoded secrets: ${summary}`,
        remediation: REMEDIATION,
      };
    }

    return {
      checkId: 'security.hardcoded-secrets',
      checkName: 'Hardcoded Secrets in Workloads',
      pillar: Pillar.Security,
      status: CheckStatus.Passing,
      message: 'No hardcoded secrets detected in workload env vars.',
      remediation: REMEDIATION,
    };
  },
};
