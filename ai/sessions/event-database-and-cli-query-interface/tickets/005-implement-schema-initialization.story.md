---
story_id: 005-implement-schema-initialization
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: completed
---

# Story: Implement Schema Initialization and Versioning

## Objective

Create the schema initialization system that creates the `schema_version` table and tracks schema migrations.

## Acceptance Criteria

- [ ] `SchemaManager` class created
- [ ] Creates `schema_version` table if not exists
- [ ] Creates `events` table with all fields and indexes
- [ ] Records initial schema version (v1)
- [ ] Detects existing schema version
- [ ] Logs schema initialization success

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/schema.ts`

## Implementation Notes

### SchemaManager Class

```typescript
import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';

export class SchemaManager {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  public initialize(): void {
    this.createSchemaVersionTable();
    this.createEventsTable();
    
    const currentVersion = this.getCurrentVersion();
    if (currentVersion === 0) {
      // First initialization
      this.recordSchemaVersion(1, 'Initial schema with events table');
      console.log('Database initialized successfully with schema version 1');
    } else {
      console.log(`Using existing database with schema version ${currentVersion}`);
    }
  }

  private createSchemaVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL,
        description TEXT
      );
    `);
  }

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
      
      CREATE INDEX IF NOT EXISTS idx_events_type 
        ON events(event_type);
      
      CREATE INDEX IF NOT EXISTS idx_events_severity 
        ON events(severity);
      
      CREATE INDEX IF NOT EXISTS idx_events_created 
        ON events(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_events_object 
        ON events(object_kind, object_namespace, object_name);
    `);
  }

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

  private recordSchemaVersion(version: number, description: string): void {
    this.db.prepare(`
      INSERT INTO schema_version (version, applied_at, description)
      VALUES (?, ?, ?)
    `).run(version, new Date().toISOString(), description);
  }
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 004 (DatabaseManager must exist)

