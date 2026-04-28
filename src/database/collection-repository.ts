/**
 * SQLite persistence for M8 collection payloads (CollectionPayload).
 */

import Database from 'better-sqlite3';
import { DatabaseManager } from './manager.js';
import { logger } from '../logging/logger.js';
import type { CollectionPayload } from '../collection/types.js';
import { CollectionPayloadSchema } from '../collection/payload-schema.js';
import { ZodError } from 'zod';

export type CollectionRowType =
  | 'cluster-metadata'
  | 'resource-inventory'
  | 'resource-configuration-patterns';

export interface CollectionFilters {
  type?: CollectionRowType;
  cluster_id?: string;
  collected_at_gte?: string;
  collected_at_lt?: string;
}

export interface CollectionQueryOptions {
  filters?: CollectionFilters;
  limit?: number;
  offset?: number;
}

export interface CollectionListRow {
  collection_id: string;
  cluster_id: string;
  type: CollectionRowType;
  collected_at: string;
}

export class CollectionRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  /**
   * Parse and insert a collection payload. Rejects type/data mismatch and malformed payloads.
   */
  public insertCollection(input: unknown): boolean {
    try {
      const payload = CollectionPayloadSchema.parse(input) as CollectionPayload;
      const collectionId = this.dataCollectionId(payload);
      const clusterId = this.dataClusterId(payload);
      const collectedAt = this.dataTimestamp(payload);

      const stmt = this.db.prepare(`
        INSERT INTO collections (
          collection_id, cluster_id, type, collected_at, payload_json
        ) VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        collectionId,
        clusterId,
        payload.type,
        collectedAt,
        JSON.stringify(payload)
      );
      return true;
    } catch (error: any) {
      if (error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        logger.warn(`Duplicate collection_id insert`);
        return false;
      }
      if (error instanceof ZodError) {
        logger.warn('Collection payload validation failed', { issues: error.issues });
        return false;
      }
      logger.error('Failed to insert collection', { error: error?.message });
      return false;
    }
  }

  public getCollectionById(collectionId: string): CollectionPayload | null {
    const row = this.db
      .prepare(
        `SELECT payload_json FROM collections WHERE collection_id = ?`
      )
      .get(collectionId) as { payload_json: string } | undefined;
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.payload_json) as unknown;
      return CollectionPayloadSchema.parse(parsed) as CollectionPayload;
    } catch {
      logger.warn('Stored collection payload failed validation', { collectionId });
      return null;
    }
  }

  public queryCollectionSummaries(options: CollectionQueryOptions = {}): CollectionListRow[] {
    const { filters = {}, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }
    if (filters.cluster_id) {
      conditions.push('cluster_id = ?');
      params.push(filters.cluster_id);
    }
    if (filters.collected_at_gte) {
      conditions.push('collected_at >= ?');
      params.push(filters.collected_at_gte);
    }
    if (filters.collected_at_lt) {
      conditions.push('collected_at < ?');
      params.push(filters.collected_at_lt);
    }

    let query = `
      SELECT collection_id, cluster_id, type, collected_at
      FROM collections
    `;
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY collected_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as CollectionListRow[];
    return rows;
  }

  public countCollections(filters: CollectionFilters = {}): number {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }
    if (filters.cluster_id) {
      conditions.push('cluster_id = ?');
      params.push(filters.cluster_id);
    }
    if (filters.collected_at_gte) {
      conditions.push('collected_at >= ?');
      params.push(filters.collected_at_gte);
    }
    if (filters.collected_at_lt) {
      conditions.push('collected_at < ?');
      params.push(filters.collected_at_lt);
    }

    let query = 'SELECT COUNT(*) as count FROM collections';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const row = this.db.prepare(query).get(...params) as { count: number };
    return row.count;
  }

  private dataCollectionId(payload: CollectionPayload): string {
    return (payload.data as { collectionId: string }).collectionId;
  }

  private dataClusterId(payload: CollectionPayload): string {
    return (payload.data as { clusterId: string }).clusterId;
  }

  private dataTimestamp(payload: CollectionPayload): string {
    return (payload.data as { timestamp: string }).timestamp;
  }
}
