/**
 * Collection metrics implementation
 * 
 * Provides Prometheus metrics for tracking collection health, success/failure rates,
 * and collection duration. Metrics follow Prometheus naming conventions.
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../logging/logger.js';

/**
 * Prometheus metrics registry
 * Exported for use by other metric modules (e.g., events)
 */
export const register = new Registry();

/**
 * Counter for collection attempts by type and status
 * 
 * Labels:
 * - type: Collection type (e.g., "cluster-metadata", "resource-inventory")
 * - status: Collection status ("success" or "failed")
 */
const collectionTotal = new Counter({
  name: 'kube9_operator_collection_total',
  help: 'Total number of collection attempts by type and status',
  labelNames: ['type', 'status'],
  registers: [register],
});

/**
 * Histogram for collection duration in seconds
 * 
 * Labels:
 * - type: Collection type (e.g., "cluster-metadata", "resource-inventory")
 * 
 * Buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120] seconds
 */
const collectionDurationSeconds = new Histogram({
  name: 'kube9_operator_collection_duration_seconds',
  help: 'Duration of collection operations in seconds',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [register],
});

/**
 * Gauge for last successful collection timestamp (Unix epoch seconds)
 * 
 * Labels:
 * - type: Collection type (e.g., "cluster-metadata", "resource-inventory")
 */
const collectionLastSuccess = new Gauge({
  name: 'kube9_operator_collection_last_success',
  help: 'Unix timestamp of last successful collection by type',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Records a collection attempt with metrics
 * 
 * @param type - Collection type (e.g., "cluster-metadata", "resource-inventory")
 * @param status - Collection status ("success" or "failed")
 * @param durationSeconds - Duration of the collection operation in seconds
 */
export function recordCollection(
  type: string,
  status: 'success' | 'failed',
  durationSeconds: number
): void {
  try {
    // Increment counter
    collectionTotal.inc({ type, status });

    // Record duration histogram
    collectionDurationSeconds.observe({ type }, durationSeconds);

    // Update last success timestamp if successful
    if (status === 'success') {
      const timestampSeconds = Math.floor(Date.now() / 1000);
      collectionLastSuccess.set({ type }, timestampSeconds);
    }

    logger.info('Collection metrics recorded', {
      type,
      status,
      durationSeconds: durationSeconds.toFixed(3),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to record collection metrics', {
      type,
      status,
      error: errorMessage,
    });
  }
}

/**
 * Returns Prometheus-formatted metrics string
 * 
 * @returns Promise resolving to Prometheus metrics string
 */
export async function getMetrics(): Promise<string> {
  try {
    return await register.metrics();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate metrics', { error: errorMessage });
    throw error;
  }
}

