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

  it('records initial schema version', () => {
    const schema = new SchemaManager();
    schema.initialize();
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const version = db.prepare(`
      SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1
    `).get() as { version: number } | undefined;
    
    expect(version).toBeTruthy();
    expect(version?.version).toBe(1);
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
    schema.initialize(); // Call twice
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    // Should still have only one version record
    const versions = db.prepare(`SELECT COUNT(*) as count FROM schema_version`).get() as { count: number };
    expect(versions.count).toBe(1);
  });

  it('detects existing schema', () => {
    const schema1 = new SchemaManager();
    schema1.initialize();
    
    const schema2 = new SchemaManager();
    schema2.initialize(); // Should detect existing schema
    
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const versions = db.prepare(`SELECT COUNT(*) as count FROM schema_version`).get() as { count: number };
    expect(versions.count).toBe(1);
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
});
