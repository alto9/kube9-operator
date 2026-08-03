/**
 * Thin helper for durable collection persistence via CollectionRepository.
 */

import type { CollectionRepository } from '../database/collection-repository.js';
import type { CollectionPayload } from './types.js';
import { logger } from '../logging/logger.js';

/**
 * Persists a validated collection payload to SQLite.
 *
 * @returns true when a new row was inserted; false on duplicate or validation failure
 */
export function persistCollection(
  repository: CollectionRepository,
  payload: CollectionPayload
): boolean {
  const inserted = repository.insertCollection(payload);
  if (!inserted) {
    logger.warn('Collection persist returned false (duplicate or validation failure)', {
      collectionId: payload.data.collectionId,
      type: payload.type,
    });
  }
  return inserted;
}
