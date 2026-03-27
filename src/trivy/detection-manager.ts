/**
 * Periodic Trivy server re-detection (presence may change after startup).
 */

import { logger } from '../logging/logger.js';
import { detectTrivyWithTimeout, type TrivyDetectionConfig } from './detection.js';
import { trivyStatusTracker } from './state.js';
import type { TrivyStatus } from '../status/types.js';

export class TrivyDetectionManager {
  private intervalHandle: NodeJS.Timeout | null = null;
  private currentStatus!: TrivyStatus;

  start(config: TrivyDetectionConfig, initialStatus: TrivyStatus): void {
    this.currentStatus = initialStatus;
    const intervalMs = config.detectionInterval * 60 * 60 * 1000;

    this.intervalHandle = setInterval(() => {
      this.performPeriodicCheck(config).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Periodic Trivy detection failed', { error: msg });
      });
    }, intervalMs);

    logger.info('Trivy periodic detection started', {
      intervalHours: config.detectionInterval,
    });
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Trivy periodic detection stopped');
    }
  }

  private async performPeriodicCheck(config: TrivyDetectionConfig): Promise<void> {
    logger.debug('Performing periodic Trivy detection');
    const newStatus = await detectTrivyWithTimeout(config);

    if (this.hasStatusChanged(newStatus)) {
      logger.info('Trivy status changed', {
        previous: {
          detected: this.currentStatus.detected,
          serverUrl: this.currentStatus.serverUrl,
        },
        current: {
          detected: newStatus.detected,
          serverUrl: newStatus.serverUrl,
        },
      });
      this.currentStatus = newStatus;
      trivyStatusTracker.setStatus(newStatus);
    } else {
      logger.debug('Trivy status unchanged, skipping tracker update');
    }
  }

  private hasStatusChanged(newStatus: TrivyStatus): boolean {
    return (
      this.currentStatus.detected !== newStatus.detected ||
      this.currentStatus.serverUrl !== newStatus.serverUrl ||
      this.currentStatus.version !== newStatus.version
    );
  }
}
