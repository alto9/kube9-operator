import type { ApplicationSnapshot } from './application-snapshot-types.js';
import { applicationSnapshotFromStatusRecord } from './application-snapshot-normalize.js';
import { getLastArgoCdApplicationStatusBatch } from './application-status-sink.js';

/**
 * Loads normalized Application snapshots for drift from the last successful
 * Application status batch ({@link runArgoCdApplicationStatusCycle}).
 */
export async function collectApplicationSnapshots(): Promise<ApplicationSnapshot[]> {
  const batch = getLastArgoCdApplicationStatusBatch();
  if (!batch) {
    return [];
  }
  return batch.applications.map(applicationSnapshotFromStatusRecord);
}
