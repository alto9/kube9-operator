/**
 * Database Manager - Singleton for SQLite database connection management
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

/**
 * DatabaseManager provides a singleton interface to the SQLite database
 * with proper WAL mode configuration for concurrent access
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: Database.Database;
  private dbPath: string;

  private constructor() {
    // Support both production and development paths
    const dataDir = process.env.DB_PATH || '/data';
    this.dbPath = path.join(dataDir, 'kube9.db');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open database connection
    this.db = new Database(this.dbPath);

    // Configure SQLite
    this.configure();
  }

  /**
   * Configure SQLite pragmas for optimal performance and concurrency
   */
  private configure(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Synchronous mode for durability
    this.db.pragma('synchronous = NORMAL');
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Cache size (10MB)
    this.db.pragma('cache_size = -10000');
  }

  /**
   * Get the singleton instance of DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get the underlying Database instance
   */
  public getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Get the database file path
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      DatabaseManager.instance = null;
    }
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static reset(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close();
    }
    DatabaseManager.instance = null;
  }
}

