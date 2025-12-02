/**
 * Event Repository - Storage methods for events
 */

import { DatabaseManager } from './manager.js';
import { Event, EventSchema } from '../types/event.js';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger.js';

export interface EventFilters {
  event_type?: string;
  severity?: string;
  created_at_gte?: string;
  created_at_lt?: string;
  object_kind?: string;
  object_namespace?: string;
  object_name?: string;
}

export interface EventQueryOptions {
  filters?: EventFilters;
  limit?: number;
  offset?: number;
}

/**
 * EventRepository provides methods for inserting and managing events in the database
 */
export class EventRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  /**
   * Insert an event into the database
   * @param event The event to insert
   * @returns true if successful, false if failed (including duplicates)
   */
  public insertEvent(event: Event): boolean {
    try {
      // Validate event with Zod
      const validated = EventSchema.parse(event);

      // Prepare insert statement
      const stmt = this.db.prepare(`
        INSERT INTO events (
          id, event_type, severity, title, description,
          object_kind, object_namespace, object_name,
          metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Serialize metadata to JSON
      const metadataJson = validated.metadata 
        ? JSON.stringify(validated.metadata) 
        : null;

      // Execute insert
      stmt.run(
        validated.id,
        validated.event_type,
        validated.severity,
        validated.title,
        validated.description || null,
        validated.object_kind || null,
        validated.object_namespace || null,
        validated.object_name || null,
        metadataJson,
        validated.created_at
      );

      return true;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        // Duplicate event ID
        logger.warn(`Duplicate event ID: ${event.id}`);
        return false;
      } else {
        logger.error('Failed to insert event', { error: error.message });
        return false;
      }
    }
  }

  /**
   * Get a single event by ID
   * @param id The event ID
   * @returns The event or null if not found
   */
  public getEventById(id: string): Event | null {
    const stmt = this.db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.deserializeEvent(row);
  }

  /**
   * Query events with filters, pagination, and sorting
   * @param options Query options including filters, limit, and offset
   * @returns Array of events matching the query
   */
  public queryEvents(options: EventQueryOptions = {}): Event[] {
    const { filters = {}, limit = 50, offset = 0 } = options;
    
    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (filters.event_type) {
      conditions.push('event_type = ?');
      params.push(filters.event_type);
    }
    
    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }
    
    if (filters.created_at_gte) {
      conditions.push('created_at >= ?');
      params.push(filters.created_at_gte);
    }
    
    if (filters.created_at_lt) {
      conditions.push('created_at < ?');
      params.push(filters.created_at_lt);
    }
    
    if (filters.object_kind) {
      conditions.push('object_kind = ?');
      params.push(filters.object_kind);
    }
    
    if (filters.object_namespace) {
      conditions.push('object_namespace = ?');
      params.push(filters.object_namespace);
    }
    
    if (filters.object_name) {
      conditions.push('object_name = ?');
      params.push(filters.object_name);
    }
    
    // Build query
    let query = 'SELECT * FROM events';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    
    params.push(limit, offset);
    
    // Execute query
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.deserializeEvent(row));
  }

  /**
   * Count events matching the given filters
   * @param filters Event filters
   * @returns Number of matching events
   */
  public countEvents(filters: EventFilters = {}): number {
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Same filter logic as queryEvents
    if (filters.event_type) {
      conditions.push('event_type = ?');
      params.push(filters.event_type);
    }
    
    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }
    
    if (filters.created_at_gte) {
      conditions.push('created_at >= ?');
      params.push(filters.created_at_gte);
    }
    
    if (filters.created_at_lt) {
      conditions.push('created_at < ?');
      params.push(filters.created_at_lt);
    }
    
    if (filters.object_kind) {
      conditions.push('object_kind = ?');
      params.push(filters.object_kind);
    }
    
    if (filters.object_namespace) {
      conditions.push('object_namespace = ?');
      params.push(filters.object_namespace);
    }
    
    if (filters.object_name) {
      conditions.push('object_name = ?');
      params.push(filters.object_name);
    }
    
    let query = 'SELECT COUNT(*) as count FROM events';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    
    return result.count;
  }

  /**
   * Deserialize a database row into an Event object
   * @param row Database row
   * @returns Event object
   */
  private deserializeEvent(row: any): Event {
    return {
      id: row.id,
      event_type: row.event_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      object_kind: row.object_kind,
      object_namespace: row.object_namespace,
      object_name: row.object_name,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
    };
  }
}

