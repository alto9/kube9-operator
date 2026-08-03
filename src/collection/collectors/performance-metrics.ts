/**
 * Performance metrics collector: optional Prometheus PromQL aggregates on ~15m schedule.
 */

import { randomBytes } from 'crypto';
import type { CollectionPayload, PerformanceMetrics } from '../types.js';
import { validatePerformanceMetrics } from '../validation.js';
import type { CollectionRepository } from '../../database/collection-repository.js';
import { persistCollection } from '../persist-collection.js';
import { generateClusterIdForCollection } from '../../cluster/identifier.js';
import { logger } from '../../logging/logger.js';
import { PrometheusClient } from '../../prometheus/client.js';
import type { PrometheusClientConfig } from '../../prometheus/types.js';

export class PerformanceMetricsCollector {
  private readonly prometheusClient: PrometheusClient;
  private readonly collectionRepository: CollectionRepository;

  constructor(prometheusConfig: PrometheusClientConfig, collectionRepository: CollectionRepository) {
    this.prometheusClient = new PrometheusClient(prometheusConfig);
    this.collectionRepository = collectionRepository;
  }

  /**
   * Queries Prometheus and builds a bounded performance-metrics snapshot.
   * @throws when Prometheus returns no usable scalar aggregates (failed tick; no row persisted)
   */
  async collect(): Promise<PerformanceMetrics> {
    logger.info('Starting performance metrics collection');

    const scalars = await this.prometheusClient.queryPerformanceScalars();
    const utilization: NonNullable<PerformanceMetrics['utilization']> = {};
    const ratios: Record<string, number> = {};

    if (scalars.cpuClusterAvg !== undefined || scalars.cpuNodeHigh !== undefined) {
      utilization.cpu = {
        ...(scalars.cpuClusterAvg !== undefined
          ? { clusterAvgRatio: scalars.cpuClusterAvg }
          : {}),
        ...(scalars.cpuNodeHigh !== undefined
          ? { nodeHighWatermarkRatio: scalars.cpuNodeHigh }
          : {}),
      };
    }

    if (scalars.memoryClusterAvg !== undefined || scalars.memoryNodeHigh !== undefined) {
      utilization.memory = {
        ...(scalars.memoryClusterAvg !== undefined
          ? { clusterAvgRatio: scalars.memoryClusterAvg }
          : {}),
        ...(scalars.memoryNodeHigh !== undefined
          ? { nodeHighWatermarkRatio: scalars.memoryNodeHigh }
          : {}),
      };
    }

    if (scalars.pendingPodsRatio !== undefined) {
      ratios.pending_pods_ratio = scalars.pendingPodsRatio;
    }

    const hasUtilization =
      (utilization.cpu && Object.keys(utilization.cpu).length > 0) ||
      (utilization.memory && Object.keys(utilization.memory).length > 0);
    const hasRatios = Object.keys(ratios).length > 0;

    if (!hasUtilization && !hasRatios) {
      const message =
        'Performance metrics collection failed: Prometheus returned no usable scalar aggregates';
      logger.error(message);
      throw new Error(message);
    }

    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      collectionId: this.generateCollectionId(),
      clusterId: generateClusterIdForCollection(),
      source: { available: true },
      ...(hasUtilization ? { utilization } : {}),
      ...(hasRatios ? { ratios } : {}),
    };

    logger.info('Performance metrics collected successfully', {
      collectionId: metrics.collectionId,
      hasCpu: Boolean(utilization.cpu),
      hasMemory: Boolean(utilization.memory),
      ratioKeys: Object.keys(ratios),
    });

    return metrics;
  }

  async processCollection(metrics: PerformanceMetrics): Promise<void> {
    try {
      const validated = validatePerformanceMetrics(metrics);

      const payload: CollectionPayload = {
        version: 'v1.0.0',
        type: 'performance-metrics',
        data: validated,
        sanitization: {
          rulesApplied: ['bounded-ratios', 'hashed-cluster-id'],
          timestamp: new Date().toISOString(),
        },
      };

      logger.info('Persisting performance metrics collection', {
        collectionId: validated.collectionId,
      });
      const inserted = persistCollection(this.collectionRepository, payload);
      if (!inserted) {
        throw new Error(
          `Failed to persist performance metrics collection: ${validated.collectionId}`
        );
      }

      logger.info('Performance metrics collection processed successfully', {
        collectionId: validated.collectionId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process performance metrics collection', {
        error: errorMessage,
        collectionId: metrics.collectionId,
      });
      throw error;
    }
  }

  private generateCollectionId(): string {
    return `coll_${randomBytes(16).toString('hex')}`;
  }
}
