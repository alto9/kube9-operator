import type { ApplicationSnapshot } from './application-snapshot-types.js';

export type SyncDriftTransitionKind =
  | 'became_out_of_sync'
  | 'became_synced'
  | 'sync_status_changed'
  | 'none';

export interface SyncStatusTransition {
  namespace: string;
  name: string;
  previousSync: ApplicationSnapshot['syncStatus'];
  currentSync: ApplicationSnapshot['syncStatus'];
  kind: SyncDriftTransitionKind;
}

/**
 * Compares consecutive snapshots for sync phase transitions (e.g. Synced → OutOfSync).
 * Intended for future history/event sinks (#57); persistence can subscribe behind this shape.
 */
export function detectSyncStatusTransition(
  previous: ApplicationSnapshot | undefined,
  current: ApplicationSnapshot
): SyncStatusTransition | null {
  if (!previous) {
    return null;
  }
  if (
    previous.namespace !== current.namespace ||
    previous.name !== current.name
  ) {
    return null;
  }

  const prevSync = previous.syncStatus;
  const curSync = current.syncStatus;

  if (prevSync === curSync) {
    return {
      namespace: current.namespace,
      name: current.name,
      previousSync: prevSync,
      currentSync: curSync,
      kind: 'none',
    };
  }

  let kind: SyncDriftTransitionKind = 'sync_status_changed';
  if (prevSync === 'Synced' && curSync === 'OutOfSync') {
    kind = 'became_out_of_sync';
  } else if (prevSync === 'OutOfSync' && curSync === 'Synced') {
    kind = 'became_synced';
  }

  return {
    namespace: current.namespace,
    name: current.name,
    previousSync: prevSync,
    currentSync: curSync,
    kind,
  };
}
