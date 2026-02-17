import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-schema-temp');

describe('SchemaManager', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
    process.env.DB_PATH = testDbDir;
  });

  afterAll(() => {
    DatabaseManager.reset();
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    delete process.env.DB_PATH;
  });

  beforeEach(() => {
    DatabaseManager.reset();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  it('creates schema_version table', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='schema_version'
    `).get() as { name: string } | undefined;
    
    expect(result).toBeTruthy();
    expect(result?.name).toBe('schema_version');
  });

  it('creates events table', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='events'
    `).get() as { name: string } | undefined;
    
    expect(result).toBeTruthy();
    expect(result?.name).toBe('events');
  });

  it('events table has correct columns', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const columns = db.prepare(`PRAGMA table_info(events)`).all() as Array<{ name: string }>;
    const columnNames = columns.map(col => col.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('event_type');
    expect(columnNames).toContain('severity');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('description');
    expect(columnNames).toContain('object_kind');
    expect(columnNames).toContain('object_namespace');
    expect(columnNames).toContain('object_name');
    expect(columnNames).toContain('metadata');
    expect(columnNames).toContain('created_at');
  });

  it('creates indexes on events table', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='events'
    `).all() as Array<{ name: string }>;
    
    const indexNames = indexes.map(idx => idx.name);
    
    expect(indexNames).toContain('idx_events_event_type');
    expect(indexNames).toContain('idx_events_severity');
    expect(indexNames).toContain('idx_events_created_at');
    expect(indexNames).toContain('idx_events_object_kind');
  });

  it('records schema versions including migrations', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const versions = db.prepare(`SELECT version FROM schema_version ORDER BY version`).all() as Array<{ version: number }>;
    
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0]?.version).toBe(1);
    expect(schema.getVersion()).toBeGreaterThanOrEqual(2);
  });

  it('schema version has correct fields', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const columns = db.prepare(`PRAGMA table_info(schema_version)`).all() as Array<{ name: string }>;
    const columnNames = columns.map(col => col.name);
    
    expect(columnNames).toContain('version');
    expect(columnNames).toContain('applied_at');
  });

  it('idempotent initialization', () => {
    const schema = new SchemaManager();
    schema.initialize();
    const countAfterFirst = schema.getVersion();
    schema.initialize(); // Call twice - should not re-apply migrations
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    // Version should remain the same; no duplicate migration records
    const versions = db.prepare(`SELECT version FROM schema_version ORDER BY version`).all() as Array<{ version: number }>;
    const uniqueVersions = new Set(versions.map((v) => v.version));
    expect(uniqueVersions.size).toBe(versions.length);
    expect(schema.getVersion()).toBe(countAfterFirst);
  });

  it('detects existing schema', () => {
    const schema1 = new SchemaManager();
    schema1.initialize();
    
    const schema2 = new SchemaManager();
    schema2.initialize(); // Should detect existing schema, run migrations if needed
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const versions = db.prepare(`SELECT COUNT(*) as count FROM schema_version`).get() as { count: number };
    expect(versions.count).toBeGreaterThanOrEqual(1);
  });

  it('events table supports inserts', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO events (id, event_type, severity, title, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run('test_id', 'cluster', 'info', 'Test Event', new Date().toISOString());
    expect(result.changes).toBe(1);
    
    const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get('test_id');
    expect(event).toBeTruthy();
  });

  it('primary key constraint works', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO events (id, event_type, severity, title, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run('dup_id', 'cluster', 'info', 'Test 1', new Date().toISOString());
    
    expect(() => {
      stmt.run('dup_id', 'cluster', 'info', 'Test 2', new Date().toISOString());
    }).toThrow();
  });

  it('creates assessments table when migrating to v2', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='assessments'
    `).get() as { name: string } | undefined;
    
    expect(result).toBeTruthy();
    expect(result?.name).toBe('assessments');
  });

  it('creates assessment_history table when migrating to v2', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='assessment_history'
    `).get() as { name: string } | undefined;
    
    expect(result).toBeTruthy();
    expect(result?.name).toBe('assessment_history');
  });

  it('assessment_history has foreign key to assessments', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const fks = db.prepare(`PRAGMA foreign_key_list(assessment_history)`).all() as Array<{ table: string; from: string; to: string }>;
    const runIdFk = fks.find((fk) => fk.from === 'run_id' && fk.table === 'assessments');
    
    expect(runIdFk).toBeTruthy();
    expect(runIdFk?.to).toBe('run_id');
  });

  it('migration from v1 to v2 is idempotent', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const versionBefore = schema.getVersion();
    schema.initialize();
    const versionAfter = schema.getVersion();
    
    expect(versionBefore).toBe(versionAfter);
    expect(versionAfter).toBeGreaterThanOrEqual(2);
  });

  it('migration runs cleanly on fresh database', () => {
    DatabaseManager.reset();
    const schema = new SchemaManager();
    schema.initialize();
    
    expect(schema.getVersion()).toBeGreaterThanOrEqual(1);
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('assessments', 'assessment_history')
    `).all() as Array<{ name: string }>;
    
    expect(tables.length).toBe(2);
  });
});
