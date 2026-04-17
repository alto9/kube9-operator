/**
 * Operational Excellence: GitOps delivery signals
 *
 * Uses the same Argo CD detection contract as the operator plus Flux CRD probes
 * to classify declarative GitOps posture and surface drift-prone or incomplete setups.
 */

import type { KubernetesClient } from '../../../kubernetes/client.js';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';
import {
  checkForApplicationCRD,
  detectArgoCD,
  parseArgoCDConfigFromEnv,
} from '../../../argocd/detection.js';

const CHECK_ID = 'operational-excellence.gitops-delivery-signals';
const CHECK_NAME = 'GitOps delivery signals';

const REMEDIATION_GENERIC =
  'Install and operate a cluster GitOps controller (Argo CD and/or Flux) so application state is reconciled from Git. For Argo CD, ensure the Application CRD is installed and the argocd-server Deployment is healthy in the expected namespace. See https://argo-cd.readthedocs.io/ and https://fluxcd.io/flux/.';

const REMEDIATION_PARTIAL_ARGO =
  'The applications.argoproj.io CRD is present but the Argo CD server Deployment was not found with the configured namespace/selector. Reconcile the install or set ARGOCD_NAMESPACE / ARGOCD_SELECTOR to match your deployment.';

const REMEDIATION_ENABLED_NO_SERVER =
  'ARGOCD_ENABLED=true but no matching Argo CD server Deployment was found. Fix the install or correct ARGOCD_NAMESPACE / ARGOCD_SELECTOR.';

/** Flux GitOps CRDs that indicate Flux is installed (any one is sufficient). */
const FLUX_GITOPS_CRD_NAMES = [
  'kustomizations.kustomize.toolkit.fluxcd.io',
  'helmreleases.helm.toolkit.fluxcd.io',
  'gitrepositories.source.toolkit.fluxcd.io',
] as const;

async function crdExists(client: KubernetesClient, name: string): Promise<boolean> {
  try {
    await client.apiextensionsApi.readCustomResourceDefinition({ name });
    return true;
  } catch {
    return false;
  }
}

async function anyFluxGitOpsCrdPresent(client: KubernetesClient): Promise<boolean> {
  for (const name of FLUX_GITOPS_CRD_NAMES) {
    if (await crdExists(client, name)) {
      return true;
    }
  }
  return false;
}

export const gitopsDeliverySignalsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.OperationalExcellence,
  description:
    'Evaluates GitOps readiness using Argo CD detection and Flux CRD signals, including incomplete Argo installs.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const client = ctx.kubernetes;
    const argoConfig = parseArgoCDConfigFromEnv();

    const [hasArgoCrd, argoStatus, fluxPresent] = await Promise.all([
      checkForApplicationCRD(client),
      detectArgoCD(client, argoConfig),
      anyFluxGitOpsCrdPresent(client),
    ]);

    if (argoStatus.detected) {
      const ver = argoStatus.version ? ` (${argoStatus.version})` : '';
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: `GitOps: Argo CD detected in namespace ${argoStatus.namespace ?? 'unknown'}${ver}`,
        remediation: REMEDIATION_GENERIC,
      };
    }

    if (fluxPresent) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message:
          'GitOps: Flux toolkit CRDs present (Kustomization / HelmRelease / GitRepository controller surface)',
        remediation: REMEDIATION_GENERIC,
      };
    }

    if (argoConfig.enabled === true) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        message:
          'GitOps: ARGOCD_ENABLED=true but Argo CD server Deployment was not found with the current namespace and label selector',
        remediation: REMEDIATION_ENABLED_NO_SERVER,
      };
    }

    if (
      hasArgoCrd &&
      !argoStatus.detected &&
      argoConfig.autoDetect !== false &&
      argoConfig.enabled !== false
    ) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.OperationalExcellence,
        status: CheckStatus.Warning,
        severity: Severity.Medium,
        message:
          'GitOps: Argo CD Application CRD exists but the Argo CD server Deployment was not found (incomplete or mis-scoped install)',
        remediation: REMEDIATION_PARTIAL_ARGO,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.OperationalExcellence,
      status: CheckStatus.Warning,
      severity: Severity.Low,
      message:
        'GitOps: No Argo CD or Flux GitOps signals detected; workload delivery may rely on imperative or external CI only',
      remediation: REMEDIATION_GENERIC,
    };
  },
};
