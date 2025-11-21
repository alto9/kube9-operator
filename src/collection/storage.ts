/**
 * Local storage implementation for free tier data collection
 * Stores collections in memory with size limits and retrieval capabilities
 */

import type { CollectionPayload } from './types.js';
import { logger } from '../logging/logger.js';
import { collectionStatsTracker } from './stats-tracker.js';

/**
 * Default maximum number of collections to store in memory
 */
const DEFAULT_MAX_COLLECTIONS = 100;

/**
 * LocalStorage provides in-memory storage for collection payloads.
 * Used by free tier operators to store collected data locally without transmission.
 * 
 * Storage is limited to prevent memory issues and maintains collections
 * in insertion order (most recent first) for efficient retrieval.
 */
export class LocalStorage {
  /**
   * Map for O(1) retrieval by collectionId
   */
  private readonly storage: Map<string, CollectionPayload> = new Map();

  /**
   * Array maintaining insertion order (most recent first)
   */
  private readonly order: CollectionPayload[] = [];

  /**
   * Maximum number of collections to store
   */
  private readonly maxCollections: number;

  /**
   * Creates a new LocalStorage instance
   * 
   * @param maxCollections - Maximum number of collections to store (default: 100)
   */
  constructor(maxCollections: number = DEFAULT_MAX_COLLECTIONS) {
    if (maxCollections < 1) {
      throw new Error(`maxCollections must be at least 1, got ${maxCollections}`);
    }
    this.maxCollections = maxCollections;
    logger.info('LocalStorage initialized', { maxCollections });
  }

  /**
   * Stores a collection payload in memory
   * 
   * If storage is at capacity, the oldest collection is removed.
   * New collections are added to the front (most recent first).
   * 
   * @param collection - Collection payload to store
   * @returns Promise that resolves when storage is complete
   */
  async store(collection: CollectionPayload): Promise<void> {
    const collectionId = collection.data.collectionId;

    // If collection already exists, remove it from order array first
    if (this.storage.has(collectionId)) {
      const index = this.order.findIndex(c => c.data.collectionId === collectionId);
      if (index !== -1) {
        this.order.splice(index, 1);
      }
    }

    // Add to front of array (most recent first)
    this.order.unshift(collection);
    this.storage.set(collectionId, collection);

    // Enforce size limit: remove oldest if at capacity
    if (this.order.length > this.maxCollections) {
      const oldest = this.order.pop();
      if (oldest) {
        this.storage.delete(oldest.data.collectionId);
        logger.debug('Collection removed due to size limit', {
          collectionId: oldest.data.collectionId,
          type: oldest.type,
          currentSize: this.order.length,
          maxCollections: this.maxCollections,
        });
      }
    }

    logger.info('Collection stored', {
      collectionId,
      type: collection.type,
      action: 'store',
      currentSize: this.order.length,
      maxCollections: this.maxCollections,
    });
    
    // Update stats tracker with new stored count
    collectionStatsTracker.updateStoredCount(this.order.length);
  }

  /**
   * Retrieves a collection payload by collection ID
   * 
   * @param collectionId - Collection ID to retrieve
   * @returns Promise resolving to collection payload or null if not found
   */
  async retrieve(collectionId: string): Promise<CollectionPayload | null> {
    const collection = this.storage.get(collectionId);

    if (collection) {
      logger.info('Collection retrieved', {
        collectionId,
        type: collection.type,
        action: 'retrieve',
      });
      return collection;
    }

    logger.debug('Collection not found', {
      collectionId,
      action: 'retrieve',
    });
    return null;
  }

  /**
   * Lists recent collections, most recent first
   * 
   * @param limit - Maximum number of collections to return
   * @returns Promise resolving to array of collection payloads (most recent first)
   */
  async listRecent(limit: number): Promise<CollectionPayload[]> {
    if (limit < 0) {
      throw new Error(`limit must be non-negative, got ${limit}`);
    }

    const result = this.order.slice(0, limit);

    logger.info('Recent collections listed', {
      limit,
      returned: result.length,
      total: this.order.length,
      action: 'listRecent',
    });

    return result;
  }

  /**
   * Gets the current number of stored collections
   * 
   * @returns Current collection count
   */
  getSize(): number {
    return this.order.length;
  }

  /**
   * Clears all stored collections
   * 
   * @returns Promise that resolves when clearing is complete
   */
  async clear(): Promise<void> {
    const size = this.order.length;
    this.storage.clear();
    this.order.length = 0;

    logger.info('Storage cleared', {
      clearedCount: size,
      action: 'clear',
    });
    
    // Update stats tracker with new stored count (0)
    collectionStatsTracker.updateStoredCount(0);
  }
}

