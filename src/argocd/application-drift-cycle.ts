/**
 * Runs drift classification after each Application snapshot batch (same scheduler
 * boundary as collection). Keeps last snapshot per app for transition detection.
 */

import { logger } from '../logging/logger.js';
import type { ApplicationSnapshot } from './application-snapshot-types.js';
import { classifyApplicationDrift } from './application-drift.js';
import { detectSyncStatusTransition } from './application-sync-transition.js';

const snapshotKey = (s: ApplicationSnapshot): string =>
  `${s.namespace}/${s.name}`;

export class ApplicationDriftCycleState {
  private readonly previousByKey = new Map<string, ApplicationSnapshot>();

  /** Exposed for tests; production uses {@link runApplicationDriftCycle} only. */
  getPreviousSnapshotForTest(key: string): ApplicationSnapshot | undefined {
    return this.previousByKey.get(key);
  }

  processBatch(snapshots: ApplicationSnapshot[]): void {
    const seen = new Set<string>();

    for (const snapshot of snapshots) {
      try {
        const drift = classifyApplicationDrift(snapshot);
        const key = snapshotKey(snapshot);
        seen.add(key);

        const prev = this.previousByKey.get(key);
        const transition = detectSyncStatusTransition(prev, snapshot);

        this.previousByKey.set(key, snapshot);

        logger.info('argocd.application.drift', {
          namespace: drift.namespace,
          name: drift.name,
          observedRevision: drift.observedRevision,
          driftDetected: drift.driftDetected,
          severity: drift.severity,
          syncStatus: drift.syncStatus,
          healthStatus: drift.healthStatus,
          reasons: drift.reasons,
          syncTransition:
            transition && transition.kind !== 'none'
              ? {
                  kind: transition.kind,
                  from: transition.previousSync,
                  to: transition.currentSync,
                }
              : null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('argocd.application.drift.classify_failed', {
          namespace: snapshot.namespace,
          name: snapshot.name,
          error: message,
        });
      }
    }

    for (const key of this.previousByKey.keys()) {
      if (!seen.has(key)) {
        this.previousByKey.delete(key);
      }
    }
  }
}

const globalDriftCycleState = new ApplicationDriftCycleState();

/**
 * Invoked after a successful snapshot collection pass; never throws to callers.
 */
export async function runApplicationDriftCycle(
  collect: () => Promise<ApplicationSnapshot[]>,
  state: ApplicationDriftCycleState = globalDriftCycleState
): Promise<void> {
  try {
    const snapshots = await collect();
    state.processBatch(snapshots);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('argocd.application.drift.cycle_failed', { error: message });
  }
}
