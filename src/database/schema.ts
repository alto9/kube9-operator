/**
 * Schema Manager - Database schema initialization and versioning
 */

import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger.js';

/** Latest schema version - bump when adding migrations */
const LATEST_SCHEMA_VERSION = 5;

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
      {
        version: 3,
        apply: () => this.migrateToV3(),
      },
      {
        version: 4,
        apply: () => this.migrateToV4(),
      },
      {
        version: 5,
        apply: () => this.migrateToV5(),
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
   * Migration v3: image vulnerability scan storage (M3 Security).
   * Retention: child rows use ON DELETE CASCADE from image_scans; optional
   * time-based pruning is left to application code (see ImageScanRepository.deleteScansCompletedBefore).
   */
  private migrateToV3(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS image_scans (
        scan_id TEXT PRIMARY KEY,
        image_reference TEXT NOT NULL,
        image_digest TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'completed', 'failed', 'skipped')),
        scanner TEXT NOT NULL,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_image_scans_image_reference ON image_scans(image_reference);
      CREATE INDEX IF NOT EXISTS idx_image_scans_completed_at ON image_scans(completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_image_scans_state ON image_scans(state);

      CREATE TABLE IF NOT EXISTS image_vulnerabilities (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        vulnerability_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        package_name TEXT,
        installed_version TEXT,
        fixed_version TEXT,
        title TEXT,
        raw_metadata TEXT,
        FOREIGN KEY (scan_id) REFERENCES image_scans(scan_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_image_vulnerabilities_scan_id ON image_vulnerabilities(scan_id);
      CREATE INDEX IF NOT EXISTS idx_image_vulnerabilities_severity ON image_vulnerabilities(severity);
      CREATE INDEX IF NOT EXISTS idx_image_vulnerabilities_vulnerability_id ON image_vulnerabilities(vulnerability_id);
    `);
  }

  /**
   * Migration v4: M8 collection payloads (SQLite persistence + CLI query path).
   */
  private migrateToV4(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        collection_id TEXT PRIMARY KEY,
        cluster_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN (
          'cluster-metadata',
          'resource-inventory',
          'resource-configuration-patterns'
        )),
        collected_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_collections_cluster_id ON collections(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(type);
      CREATE INDEX IF NOT EXISTS idx_collections_collected_at ON collections(collected_at DESC);
    `);
  }

  /**
   * Migration v5: M9 Argo CD Application snapshots (`argocd_apps`).
   */
  private migrateToV5(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS argocd_apps (
        cluster_id TEXT NOT NULL,
        app_namespace TEXT NOT NULL,
        app_name TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        status_json TEXT NOT NULL,
        drift_json TEXT,
        PRIMARY KEY (cluster_id, app_namespace, app_name)
      );

      CREATE INDEX IF NOT EXISTS idx_argocd_apps_cluster_observed
        ON argocd_apps(cluster_id, observed_at DESC);
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

