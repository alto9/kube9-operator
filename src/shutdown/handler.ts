import type { StatusWriter } from '../status/writer.js';
import type { CollectionScheduler } from '../collection/scheduler.js';
import type { ArgoCDDetectionManager } from '../argocd/detection-manager.js';
import type { TrivyDetectionManager } from '../trivy/detection-manager.js';
import type { KubernetesEventWatcher } from '../events/kubernetes-event-watcher.js';
import type { EventQueueWorker } from '../events/queue-worker.js';
import { stopHealthServer } from '../health/server.js';
import type { OperatorStatus } from '../status/types.js';
import { logger } from '../logging/logger.js';
import { collectionStatsTracker } from '../collection/stats-tracker.js';
import { argocdStatusTracker } from '../argocd/state.js';
import { trivyStatusTracker } from '../trivy/state.js';
import {
  buildAssessmentScheduleContextFromConfig,
  buildAssessmentStatusSummary,
  DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT,
} from '../status/assessment-summary.js';
import { getConfig } from '../config/loader.js';
import { getScheduledAssessmentLastRunSnapshot } from '../assessment/scheduled-tick.js';

/**
 * Operator version (semver)
 * Must match version in status/calculator.ts
 */
const OPERATOR_VERSION = '1.0.0';

/**
 * Shutdown timeout in milliseconds (5 seconds)
 */
const SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * Flag to prevent multiple shutdown attempts
 */
let isShuttingDown = false;

/**
 * Gracefully shuts down the operator
 *
 * Handles SIGTERM and SIGINT signals by:
 * 1. Stopping all background services (event system, collection scheduler, ArgoCD detection manager, status writer, health server)
 * 2. Writing a final status update indicating shutdown
 * 3. Exiting cleanly with code 0
 *
 * Includes a 5-second timeout to force exit if shutdown hangs.
 */
export async function gracefulShutdown(
  statusWriter: StatusWriter,
  collectionScheduler: CollectionScheduler | null,
  argoCDDetectionManager: ArgoCDDetectionManager | null,
  trivyDetectionManager: TrivyDetectionManager | null,
  eventWatcher: KubernetesEventWatcher | null,
  eventQueueWorker: EventQueueWorker | null
): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info('Shutdown initiated, beginning graceful shutdown...');

  const timeoutId = setTimeout(() => {
    logger.error('Shutdown timeout reached, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    if (eventWatcher) {
      eventWatcher.stop();
    }

    if (eventQueueWorker) {
      await eventQueueWorker.stop();
    }

    if (collectionScheduler) {
      collectionScheduler.stop();
    }

    if (argoCDDetectionManager) {
      argoCDDetectionManager.stop();
    }

    if (trivyDetectionManager) {
      trivyDetectionManager.stop();
    }

    statusWriter.stop();

    await stopHealthServer();

    const collectionStats = collectionStatsTracker.getStats();
    const argocdStatus = argocdStatusTracker.getStatus();
    const trivyStatus = trivyStatusTracker.getStatus();
    let assessmentSchedule = DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT;
    try {
      assessmentSchedule = buildAssessmentScheduleContextFromConfig(getConfig());
    } catch {
      // ignore
    }
    const assessmentSummary = buildAssessmentStatusSummary(
      getScheduledAssessmentLastRunSnapshot(),
      assessmentSchedule
    );
    const finalStatus: OperatorStatus = {
      mode: 'operated',
      version: OPERATOR_VERSION,
      health: 'unhealthy',
      lastUpdate: new Date().toISOString(),
      error: 'Shutting down',
      namespace: process.env.POD_NAMESPACE || 'kube9-system',
      collectionStats: {
        totalSuccessCount: collectionStats.totalSuccessCount,
        totalFailureCount: collectionStats.totalFailureCount,
        collectionsStoredCount: collectionStats.collectionsStoredCount,
        lastSuccessTime: collectionStats.lastSuccessTime,
      },
      argocd: argocdStatus,
      trivy: trivyStatus,
      assessment: {
        ...assessmentSummary,
        lastScheduledTotals: { ...assessmentSummary.lastScheduledTotals },
        lastScheduledChecks: assessmentSummary.lastScheduledChecks.map((c) => ({ ...c })),
      },
    };

    await statusWriter.writeFinalStatus(finalStatus);

    clearTimeout(timeoutId);

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error during graceful shutdown', { error: errorMessage });

    clearTimeout(timeoutId);

    process.exit(0);
  }
}
