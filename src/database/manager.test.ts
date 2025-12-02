import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from './manager.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-db-temp');

describe('DatabaseManager', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
  });

  afterAll(() => {
    DatabaseManager.reset();
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    process.env.DB_PATH = testDbDir;
    DatabaseManager.reset();
  });

  afterEach(() => {
    DatabaseManager.reset();
    delete process.env.DB_PATH;
  });

  it('singleton pattern', () => {
    const instance1 = DatabaseManager.getInstance();
    const instance2 = DatabaseManager.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('creates database at correct path', () => {
    const manager = DatabaseManager.getInstance();
    const dbPath = manager.getDbPath();
    
    expect(dbPath).toBe(path.join(testDbDir, 'kube9.db'));
    expect(existsSync(dbPath)).toBe(true);
  });

  it('creates data directory if missing', () => {
    const newDir = path.join(testDbDir, 'nested', 'dir');
    process.env.DB_PATH = newDir;
    DatabaseManager.reset();
    
    const manager = DatabaseManager.getInstance();
    
    expect(existsSync(newDir)).toBe(true);
    expect(existsSync(manager.getDbPath())).toBe(true);
  });

  it('enables WAL mode', () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.pragma('journal_mode', { simple: true }) as string;
    expect(result).toBe('wal');
  });

  it('enables foreign keys', () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.pragma('foreign_keys', { simple: true }) as number;
    expect(result).toBe(1);
  });

  it('sets synchronous mode to NORMAL', () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.pragma('synchronous', { simple: true }) as number;
    expect(result).toBe(1);
  });

  it('sets cache size', () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    const result = db.pragma('cache_size', { simple: true }) as number;
    expect(result).toBe(-10000);
  });

  it('getDatabase returns Database instance', () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    expect(db).toBeTruthy();
    expect(typeof db.prepare).toBe('function');
  });

  it('close method works', () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    
    expect(db.open).toBe(true);
    
    manager.close();
    
    expect(db.open).toBe(false);
    
    const newManager = DatabaseManager.getInstance();
    expect(newManager).not.toBe(manager);
  });

  it('uses /data as default path', () => {
    delete process.env.DB_PATH;
    
    process.env.DB_PATH = testDbDir;
    
    const manager = DatabaseManager.getInstance();
    const dbPath = manager.getDbPath();
    
    expect(dbPath.includes('kube9.db')).toBe(true);
  });
});
