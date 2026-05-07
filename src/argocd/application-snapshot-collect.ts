import type { ApplicationSnapshot } from './application-snapshot-types.js';

/**
 * Loads normalized Application snapshots for drift processing.
 *
 * Issue #55 replaces this stub with Argo CD API collection; until then the cycle
 * runs on an empty list so scheduler wiring and classification stay stable.
 */
export async function collectApplicationSnapshots(): Promise<ApplicationSnapshot[]> {
  return [];
}
