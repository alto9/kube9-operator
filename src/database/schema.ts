/**
 * Schema Manager - Database schema initialization and versioning
 */

import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger.js';

/** Latest schema version - bump when adding migrations */
const LATEST_SCHEMA_VERSION = 2;

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
    }

    // Run migrations for versions > current
    this.runMigrations(currentVersion);

    const finalVersion = this.getCurrentVersion();
    logger.info(`Database schema at version ${finalVersion}`);
  }

  /**
   * Run pending migrations from (currentVersion, LATEST_SCHEMA_VERSION]
   */
  private runMigrations(currentVersion: number): void {
    const migrations: Array<{ version: number; apply: () => void }> = [
      {
        version: 2,
        apply: () => this.migrateToV2(),
      },
    ];

    for (const { version, apply } of migrations) {
      if (version > currentVersion && version <= LATEST_SCHEMA_VERSION) {
        logger.info(`Applying migration to schema version ${version}`);
        apply();
        this.recordSchemaVersion(version, `Migration ${version}`);
      }
    }
  }

  /**
   * Migration v2: Add assessments and assessment_history tables
   */
  private migrateToV2(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assessments (
        run_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('full', 'pillar', 'single-check')),
        state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'completed', 'failed', 'partial')),
        requested_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        total_checks INTEGER NOT NULL DEFAULT 0,
        completed_checks INTEGER NOT NULL DEFAULT 0,
        passed_checks INTEGER NOT NULL DEFAULT 0,
        failed_checks INTEGER NOT NULL DEFAULT 0,
        warning_checks INTEGER NOT NULL DEFAULT 0,
        skipped_checks INTEGER NOT NULL DEFAULT 0,
        error_checks INTEGER NOT NULL DEFAULT 0,
        timeout_checks INTEGER NOT NULL DEFAULT 0,
        failure_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_assessments_state ON assessments(state);
      CREATE INDEX IF NOT EXISTS idx_assessments_requested_at ON assessments(requested_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assessments_completed_at ON assessments(completed_at DESC);

      CREATE TABLE IF NOT EXISTS assessment_history (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        check_id TEXT NOT NULL,
        pillar TEXT NOT NULL,
        check_name TEXT,
        status TEXT NOT NULL CHECK (status IN ('passing', 'failing', 'warning', 'skipped', 'error', 'timeout')),
        object_kind TEXT,
        object_namespace TEXT,
        object_name TEXT,
        message TEXT,
        remediation TEXT,
        assessed_at TEXT NOT NULL,
        duration_ms INTEGER,
        error_code TEXT,
        FOREIGN KEY (run_id) REFERENCES assessments(run_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_assessment_history_run_id ON assessment_history(run_id);
      CREATE INDEX IF NOT EXISTS idx_assessment_history_pillar ON assessment_history(pillar);
      CREATE INDEX IF NOT EXISTS idx_assessment_history_status ON assessment_history(status);
      CREATE INDEX IF NOT EXISTS idx_assessment_history_assessed_at ON assessment_history(assessed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assessment_history_run_pillar ON assessment_history(run_id, pillar);
    `);
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

