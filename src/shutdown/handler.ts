import type { StatusWriter } from '../status/writer.js';
import type { RegistrationManager } from '../registration/manager.js';
import type { CollectionScheduler } from '../collection/scheduler.js';
import { stopHealthServer } from '../health/server.js';
import { getConfig } from '../config/loader.js';
import type { OperatorStatus } from '../status/types.js';
import { logger } from '../logging/logger.js';
import { collectionStatsTracker } from '../collection/stats-tracker.js';

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
 * 1. Stopping all background services (collection scheduler, status writer, registration manager, health server)
 * 2. Writing a final status update indicating shutdown
 * 3. Exiting cleanly with code 0
 * 
 * Includes a 5-second timeout to force exit if shutdown hangs.
 * 
 * @param statusWriter - Status writer instance to stop and use for final status update
 * @param registrationManager - Optional registration manager instance to stop
 * @param collectionScheduler - Optional collection scheduler instance to stop
 */
export async function gracefulShutdown(
  statusWriter: StatusWriter,
  registrationManager: RegistrationManager | null,
  collectionScheduler: CollectionScheduler | null
): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  logger.info('Shutdown initiated, beginning graceful shutdown...');

  // Set up timeout to force exit if shutdown hangs
  const timeoutId = setTimeout(() => {
    logger.error('Shutdown timeout reached, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Stop collection scheduler if present (clears all collection timers)
    if (collectionScheduler) {
      collectionScheduler.stop();
    }

    // Stop status writer (clears interval)
    statusWriter.stop();

    // Stop registration manager if present (clears timers)
    if (registrationManager) {
      registrationManager.stop();
    }

    // Stop health server (closes HTTP server)
    await stopHealthServer();

    // Get current config to build final status
    const config = getConfig();
    
    // Get registration state if manager is available
    const registrationState = registrationManager
      ? registrationManager.getState()
      : { isRegistered: false, clusterId: undefined, consecutiveFailures: 0 };

    // Build final status indicating shutdown
    const collectionStats = collectionStatsTracker.getStats();
    const finalStatus: OperatorStatus = {
      mode: config.apiKey ? "enabled" : "operated",
      tier: config.apiKey && registrationState.isRegistered ? "pro" : "free",
      version: OPERATOR_VERSION,
      health: "unhealthy",
      lastUpdate: new Date().toISOString(),
      registered: registrationState.isRegistered,
      apiKeyConfigured: !!config.apiKey,
      error: "Shutting down",
      collectionStats: {
        totalSuccessCount: collectionStats.totalSuccessCount,
        totalFailureCount: collectionStats.totalFailureCount,
        collectionsStoredCount: collectionStats.collectionsStoredCount,
        lastSuccessTime: collectionStats.lastSuccessTime
      }
    };

    // Include clusterId if registered
    if (registrationState.isRegistered && registrationState.clusterId) {
      finalStatus.clusterId = registrationState.clusterId;
    }

    // Write final status update
    await statusWriter.writeFinalStatus(finalStatus);

    // Clear timeout since shutdown completed successfully
    clearTimeout(timeoutId);

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error during graceful shutdown', { error: errorMessage });
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    // Exit anyway - shutdown should always complete
    process.exit(0);
  }
}

