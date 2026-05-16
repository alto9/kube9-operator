/**
 * Deterministic drift classification from a single Application snapshot (GitOps
 * comparison semantics via Argo CD sync/health signals). Persistence (#57) should
 * consume {@link ApplicationDriftResult} objects, not raw API payloads.
 */

import type {
  ApplicationSnapshot,
  ApplicationSyncPhase,
} from './application-snapshot-types.js';

export type DriftSeverity = 'none' | 'info' | 'warning' | 'critical';

export interface ApplicationDriftResult {
  namespace: string;
  name: string;
  observedRevision: string | null;
  driftDetected: boolean;
  severity: DriftSeverity;
  syncStatus: ApplicationSyncPhase;
  healthStatus: ApplicationSnapshot['healthStatus'];
  reasons: string[];
}

function escalateSeverity(
  current: DriftSeverity,
  next: DriftSeverity
): DriftSeverity {
  const rank: DriftSeverity[] = ['none', 'info', 'warning', 'critical'];
  return rank.indexOf(next) > rank.indexOf(current) ? next : current;
}

/**
 * Classifies GitOps drift for one Application from its normalized snapshot.
 */
export function classifyApplicationDrift(
  snapshot: ApplicationSnapshot
): ApplicationDriftResult {
  const base: ApplicationDriftResult = {
    namespace: snapshot.namespace,
    name: snapshot.name,
    observedRevision: snapshot.observedRevision,
    driftDetected: false,
    severity: 'none',
    syncStatus: snapshot.syncStatus,
    healthStatus: snapshot.healthStatus,
    reasons: [],
  };

  if (snapshot.namespace === '' || snapshot.name === '') {
    return {
      ...base,
      severity: 'info',
      reasons: ['incomplete_application_identity'],
    };
  }

  if (snapshot.syncStatus === 'Unknown') {
    return {
      ...base,
      severity: 'info',
      reasons: ['sync_status_unknown'],
    };
  }

  if (snapshot.syncStatus === 'OutOfSync') {
    let severity: DriftSeverity = 'warning';
    const reasons = ['sync_out_of_sync'];

    if (snapshot.healthStatus === 'Missing') {
      severity = escalateSeverity(severity, 'critical');
      reasons.push('health_missing');
    }

    const roc = snapshot.resourcesOutOfSyncCount;
    if (roc !== undefined && roc > 0) {
      reasons.push(`resources_out_of_sync_count:${roc}`);
    }

    return {
      ...base,
      driftDetected: true,
      severity,
      reasons,
    };
  }

  // Synced — no Git-vs-live drift; surface degraded operational posture separately.
  if (snapshot.healthStatus === 'Healthy') {
    return {
      ...base,
      reasons: ['synced_healthy'],
    };
  }

  if (
    snapshot.healthStatus === 'Degraded' ||
    snapshot.healthStatus === 'Missing'
  ) {
    return {
      ...base,
      severity: 'warning',
      reasons:
        snapshot.healthStatus === 'Missing'
          ? ['synced_health_missing']
          : ['synced_health_degraded'],
    };
  }

  if (
    snapshot.healthStatus === 'Unknown' ||
    snapshot.healthStatus === 'Progressing' ||
    snapshot.healthStatus === 'Suspended'
  ) {
    return {
      ...base,
      severity: 'info',
      reasons: [`health_${snapshot.healthStatus.toLowerCase()}`],
    };
  }

  return base;
}
