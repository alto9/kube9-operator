import type {
  ApplicationHealthPhase,
  ApplicationSnapshot,
  ApplicationSyncPhase,
} from './application-snapshot-types.js';
import type { ArgoCdApplicationStatusRecord } from './application-status-types.js';

const SYNC: Record<string, ApplicationSyncPhase> = {
  synced: 'Synced',
  outofsync: 'OutOfSync',
  unknown: 'Unknown',
};

const HEALTH: Record<string, ApplicationHealthPhase> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  missing: 'Missing',
  progressing: 'Progressing',
  suspended: 'Suspended',
  unknown: 'Unknown',
};

function normSync(raw: unknown): ApplicationSyncPhase {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return 'Unknown';
  }
  const k = raw.trim().toLowerCase().replace(/\s+/g, '');
  return SYNC[k] ?? 'Unknown';
}

function normHealth(raw: unknown): ApplicationHealthPhase {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return 'Unknown';
  }
  const k = raw.trim().toLowerCase().replace(/\s+/g, '');
  return HEALTH[k] ?? 'Unknown';
}

function readString(v: unknown): string | null {
  if (typeof v !== 'string') {
    return null;
  }
  const t = v.trim();
  return t === '' ? null : t;
}

function readPositiveInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    return Math.floor(v);
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n) && n >= 0) {
      return n;
    }
  }
  return undefined;
}

function countResourcesOutOfSync(resources: unknown): number | undefined {
  if (!Array.isArray(resources)) {
    return undefined;
  }
  let n = 0;
  for (const item of resources) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const st = (item as { status?: unknown }).status;
    if (typeof st === 'string' && st.trim().toLowerCase().replace(/\s+/g, '') === 'outofsync') {
      n += 1;
    }
  }
  return n;
}

/**
 * Maps partial Argo CD Application API JSON (or similar) into {@link ApplicationSnapshot}.
 * Missing or invalid fields yield safe defaults (Unknown phases, null revision) so callers
 * can classify drift without throwing.
 */
export function normalizeApplicationSnapshot(raw: unknown): ApplicationSnapshot {
  if (raw === null || typeof raw !== 'object') {
    return {
      namespace: '',
      name: '',
      observedRevision: null,
      syncStatus: 'Unknown',
      healthStatus: 'Unknown',
    };
  }

  const root = raw as Record<string, unknown>;
  const meta =
    root.metadata && typeof root.metadata === 'object'
      ? (root.metadata as Record<string, unknown>)
      : {};
  const status =
    root.status && typeof root.status === 'object'
      ? (root.status as Record<string, unknown>)
      : {};

  const namespace = readString(meta.namespace) ?? '';
  const name = readString(meta.name) ?? '';

  const syncBlock =
    status.sync && typeof status.sync === 'object'
      ? (status.sync as Record<string, unknown>)
      : {};
  const healthBlock =
    status.health && typeof status.health === 'object'
      ? (status.health as Record<string, unknown>)
      : {};

  const syncStatus = normSync(syncBlock.status);
  const healthStatus = normHealth(healthBlock.status);

  const observedRevision =
    readString(status.revision) ??
    readString(syncBlock.revision) ??
    readString((syncBlock as { targetRevision?: unknown }).targetRevision);

  const fromResources = countResourcesOutOfSync(status.resources);
  const resourcesOutOfSyncCount =
    readPositiveInt((syncBlock as { outOfSync?: unknown }).outOfSync) ??
    (fromResources !== undefined && fromResources > 0 ? fromResources : undefined);

  return {
    namespace,
    name,
    observedRevision,
    syncStatus,
    healthStatus,
    ...(resourcesOutOfSyncCount !== undefined
      ? { resourcesOutOfSyncCount }
      : {}),
  };
}

/**
 * Maps a normalized Application status record from the REST collector into
 * {@link ApplicationSnapshot} for drift classification.
 */
export function applicationSnapshotFromStatusRecord(
  r: ArgoCdApplicationStatusRecord
): ApplicationSnapshot {
  // When ArgoCdApplicationStatusRecord gains resourcesOutOfSyncCount (#55), forward it here.
  return {
    namespace: r.namespace,
    name: r.name,
    observedRevision: r.revision,
    syncStatus: normSync(r.syncStatus),
    healthStatus: normHealth(r.healthStatus),
  };
}
