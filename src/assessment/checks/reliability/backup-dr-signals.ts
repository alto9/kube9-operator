/**
 * Reliability Check: Backup and Disaster Recovery Signals
 *
 * Cluster-level check: Detects presence of backup/DR-related operators or CRDs
 * that can be confirmed from the API:
 * - Velero: Deployment with app.kubernetes.io/name=velero (common in velero namespace)
 * - VolumeSnapshot CRD: snapshot.storage.k8s.io (CSI snapshot support)
 * - Snapshot controller: Deployment typically named snapshot-controller or csi-snapshot-controller
 *
 * Limitations (API-observable only):
 * - Does not verify backups are scheduled or restores work
 * - Does not detect other backup tools (e.g., Stash, Restic direct)
 * - Snapshot controller detection is heuristic (deployment name pattern)
 *
 * Caveats:
 * - False positive: snapshot-controller name varies by distro
 * - False negative: Velero in non-standard namespace without standard labels
 */

import * as k8s from '@kubernetes/client-node';
import type { AssessmentCheck, AssessmentCheckResult, AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus, Severity } from '../../types.js';

const CHECK_ID = 'reliability.backup-dr-signals';
const CHECK_NAME = 'Backup and Disaster Recovery Signals';
const REMEDIATION_VELERO =
  'Install Velero for backup/restore: https://velero.io/docs/';
const REMEDIATION_CSI_SNAPSHOTS =
  'Install CSI snapshot controller and VolumeSnapshot CRDs for volume snapshots';

/** Velero Helm chart uses app.kubernetes.io/name=velero */
const VELERO_LABEL_NAME = 'app.kubernetes.io/name';
const VELERO_LABEL_VALUE = 'velero';

/** VolumeSnapshot CRD group (CSI snapshot API) */
const VOLUME_SNAPSHOT_GROUP = 'snapshot.storage.k8s.io';
const VOLUME_SNAPSHOT_CRD_NAMES = ['volumesnapshots.snapshot.storage.k8s.io', 'volumesnapshots'];

/** Common snapshot controller deployment name patterns */
const SNAPSHOT_CONTROLLER_NAMES = ['snapshot-controller', 'csi-snapshot-controller', 'snapshot-controller-operator'];

function hasVeleroLabel(labels: Record<string, string> | undefined): boolean {
  if (!labels) return false;
  return labels[VELERO_LABEL_NAME] === VELERO_LABEL_VALUE;
}

function isVeleroDeployment(d: k8s.V1Deployment): boolean {
  const labels = d.metadata?.labels as Record<string, string> | undefined;
  const templateLabels = d.spec?.template?.metadata?.labels as Record<string, string> | undefined;
  return hasVeleroLabel(labels) || hasVeleroLabel(templateLabels);
}

function isSnapshotControllerDeployment(d: k8s.V1Deployment): boolean {
  const name = (d.metadata?.name ?? '').toLowerCase();
  return SNAPSHOT_CONTROLLER_NAMES.some((pat) => name.includes(pat.toLowerCase()));
}

function crdHasVolumeSnapshot(crd: k8s.V1CustomResourceDefinition): boolean {
  const crdName = (crd.metadata?.name ?? '').toLowerCase();
  const spec = crd.spec;
  const group = spec?.group ?? '';
  if (group !== VOLUME_SNAPSHOT_GROUP) return false;
  return VOLUME_SNAPSHOT_CRD_NAMES.some((n) => crdName.includes(n.toLowerCase()));
}

export const backupDrSignalsCheck: AssessmentCheck = {
  id: CHECK_ID,
  name: CHECK_NAME,
  pillar: Pillar.Reliability,
  description:
    'Detects cluster-level backup/DR signals: Velero, VolumeSnapshot CRDs, snapshot-controller. API-observable only; does not run restore tests.',
  defaultSeverity: Severity.Medium,

  async run(ctx: AssessmentRunContext): Promise<AssessmentCheckResult> {
    const [crdsRes, deploymentsRes] = await Promise.all([
      ctx.kubernetes.apiextensionsApi.listCustomResourceDefinition(),
      ctx.kubernetes.appsApi.listDeploymentForAllNamespaces(),
    ]);

    const crdList = crdsRes as unknown as {
      body?: { items?: k8s.V1CustomResourceDefinition[] };
      items?: k8s.V1CustomResourceDefinition[];
    };
    const crds = crdList.body?.items ?? crdList.items ?? [];
    const deployments = deploymentsRes.items ?? [];

    const hasVelero = deployments.some(isVeleroDeployment);
    const hasVolumeSnapshotCrd = crds.some(crdHasVolumeSnapshot);
    const hasSnapshotController = deployments.some(isSnapshotControllerDeployment);

    const signals: string[] = [];
    if (hasVelero) signals.push('Velero');
    if (hasVolumeSnapshotCrd) signals.push('VolumeSnapshot CRD');
    if (hasSnapshotController) signals.push('snapshot-controller');

    if (signals.length > 0) {
      return {
        checkId: CHECK_ID,
        checkName: CHECK_NAME,
        pillar: Pillar.Reliability,
        status: CheckStatus.Passing,
        severity: Severity.Medium,
        message: `DR/backup signals detected: ${signals.join(', ')}`,
        remediation: undefined,
      };
    }

    return {
      checkId: CHECK_ID,
      checkName: CHECK_NAME,
      pillar: Pillar.Reliability,
      status: CheckStatus.Warning,
      severity: Severity.Medium,
      message:
        'No backup/DR tooling detected (Velero, VolumeSnapshot CRDs, or snapshot-controller). Consider installing backup capabilities.',
      remediation: `${REMEDIATION_VELERO} ${REMEDIATION_CSI_SNAPSHOTS}`,
    };
  },
};
