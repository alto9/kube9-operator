/**
 * Collection statistics tracker
 * 
 * Tracks aggregated collection statistics for inclusion in operator status.
 * Provides a simple in-memory store of collection metrics that can be
 * exported to the operator status ConfigMap.
 */

import { logger } from '../logging/logger.js';

/**
 * Statistics for a single collection type
 */
interface CollectionTypeStats {
  /** Total number of successful collections */
  successCount: number;
  
  /** Total number of failed collections */
  failureCount: number;
  
  /** Timestamp of last successful collection (ISO 8601) */
  lastSuccessTime: string | null;
  
  /** Timestamp of last failed collection (ISO 8601) */
  lastFailureTime: string | null;
}

/**
 * Overall collection statistics
 */
export interface CollectionStats {
  /** Total number of successful collections across all types */
  totalSuccessCount: number;
  
  /** Total number of failed collections across all types */
  totalFailureCount: number;
  
  /** Number of collections currently stored locally */
  collectionsStoredCount: number;
  
  /** Timestamp of most recent successful collection (ISO 8601) */
  lastSuccessTime: string | null;
  
  /** Statistics by collection type */
  byType: {
    [key: string]: CollectionTypeStats;
  };
}

/**
 * CollectionStatsTracker maintains aggregated collection statistics
 * that can be included in operator status updates.
 */
export class CollectionStatsTracker {
  private stats: Map<string, CollectionTypeStats> = new Map();
  private collectionsStoredCount: number = 0;

  /**
   * Records a successful collection
   * 
   * @param type - Collection type (e.g., "cluster-metadata", "resource-inventory")
   */
  recordSuccess(type: string): void {
    const stats = this.getOrCreateStats(type);
    stats.successCount++;
    stats.lastSuccessTime = new Date().toISOString();
    
    logger.debug('Collection success recorded', { type, successCount: stats.successCount });
  }

  /**
   * Records a failed collection
   * 
   * @param type - Collection type (e.g., "cluster-metadata", "resource-inventory")
   */
  recordFailure(type: string): void {
    const stats = this.getOrCreateStats(type);
    stats.failureCount++;
    stats.lastFailureTime = new Date().toISOString();
    
    logger.debug('Collection failure recorded', { type, failureCount: stats.failureCount });
  }

  /**
   * Updates the count of collections stored locally
   * 
   * @param count - Current number of stored collections
   */
  updateStoredCount(count: number): void {
    this.collectionsStoredCount = count;
  }

  /**
   * Gets current collection statistics
   * 
   * @returns Current collection statistics
   */
  getStats(): CollectionStats {
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    let lastSuccessTime: string | null = null;

    const byType: { [key: string]: CollectionTypeStats } = {};

    // Aggregate stats across all types
    for (const [type, typeStats] of this.stats.entries()) {
      totalSuccessCount += typeStats.successCount;
      totalFailureCount += typeStats.failureCount;

      // Track most recent success time
      if (typeStats.lastSuccessTime) {
        if (!lastSuccessTime || typeStats.lastSuccessTime > lastSuccessTime) {
          lastSuccessTime = typeStats.lastSuccessTime;
        }
      }

      byType[type] = { ...typeStats };
    }

    return {
      totalSuccessCount,
      totalFailureCount,
      collectionsStoredCount: this.collectionsStoredCount,
      lastSuccessTime,
      byType,
    };
  }

  /**
   * Resets all statistics (useful for testing)
   */
  reset(): void {
    this.stats.clear();
    this.collectionsStoredCount = 0;
    logger.info('Collection statistics reset');
  }

  /**
   * Gets or creates statistics for a collection type
   * 
   * @param type - Collection type
   * @returns Statistics for the type
   */
  private getOrCreateStats(type: string): CollectionTypeStats {
    let stats = this.stats.get(type);
    if (!stats) {
      stats = {
        successCount: 0,
        failureCount: 0,
        lastSuccessTime: null,
        lastFailureTime: null,
      };
      this.stats.set(type, stats);
    }
    return stats;
  }
}

/**
 * Singleton instance of the collection stats tracker
 */
export const collectionStatsTracker = new CollectionStatsTracker();

