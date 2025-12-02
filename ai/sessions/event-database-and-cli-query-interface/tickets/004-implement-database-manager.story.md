---
story_id: 004-implement-database-manager
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: pending
---

# Story: Implement DatabaseManager with Connection Management

## Objective

Create the `DatabaseManager` singleton class that manages the SQLite database connection with proper WAL mode configuration.

## Acceptance Criteria

- [ ] `DatabaseManager` class created as singleton
- [ ] Connects to `/data/kube9.db`
- [ ] Enables WAL mode for concurrency
- [ ] Configures pragmas (synchronous, foreign_keys, cache_size)
- [ ] Provides `getInstance()` method
- [ ] Handles connection errors gracefully
- [ ] Supports both in-cluster (/data) and local development paths

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/manager.ts`

## Implementation Notes

### DatabaseManager Class

```typescript
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

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

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      DatabaseManager.instance = null;
    }
  }
}
```

## Estimated Time

< 25 minutes

## Dependencies

- Story 001 (better-sqlite3 must be installed)

