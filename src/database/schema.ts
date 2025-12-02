/**
 * Schema Manager - Database schema initialization and versioning
 */

import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger.js';

/**
 * SchemaManager handles database schema initialization and migrations
 */
export class SchemaManager {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  /**
   * Initialize the database schema
   */
  public initialize(): void {
    this.createSchemaVersionTable();
    this.createEventsTable();
    
    const currentVersion = this.getCurrentVersion();
    if (currentVersion === 0) {
      // First initialization
      this.recordSchemaVersion(1, 'Initial schema with events table');
      logger.info('Database initialized successfully with schema version 1');
    } else {
      logger.info(`Using existing database with schema version ${currentVersion}`);
    }
  }

  /**
   * Create the schema_version table for tracking migrations
   */
  private createSchemaVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL,
        description TEXT
      );
    `);
  }

  /**
   * Create the events table with indexes
   */
  private createEventsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        object_kind TEXT,
        object_namespace TEXT,
        object_name TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_event_type 
        ON events(event_type);
      
      CREATE INDEX IF NOT EXISTS idx_events_severity 
        ON events(severity);
      
      CREATE INDEX IF NOT EXISTS idx_events_created_at 
        ON events(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_events_object_kind 
        ON events(object_kind, object_namespace, object_name);
    `);
  }

  /**
   * Get the current schema version
   */
  private getCurrentVersion(): number {
    try {
      const result = this.db.prepare(
        'SELECT MAX(version) as version FROM schema_version'
      ).get() as { version: number | null };
      
      return result?.version || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Record a schema version in the schema_version table
   */
  private recordSchemaVersion(version: number, description: string): void {
    this.db.prepare(`
      INSERT INTO schema_version (version, applied_at, description)
      VALUES (?, ?, ?)
    `).run(version, new Date().toISOString(), description);
  }

  /**
   * Get the current schema version (public for testing)
   */
  public getVersion(): number {
    return this.getCurrentVersion();
  }
}

