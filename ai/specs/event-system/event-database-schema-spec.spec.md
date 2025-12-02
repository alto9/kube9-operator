---
spec_id: event-database-schema-spec
feature_id: [event-database-storage]
context_id: [nodejs-sqlite]
---

# Event Database Schema Specification

## Overview

This specification defines the SQLite database schema for storing operator events, including the schema versioning system, tables, indexes, and migration strategy.

## Database Configuration

### File Location
- **Path**: `/data/kube9.db`
- **Mount**: PersistentVolume at `/data`
- **Minimum Size**: 1Gi (recommended)

### SQLite Settings
```sql
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Synchronous mode for durability
PRAGMA synchronous = NORMAL;

-- Foreign keys enforcement
PRAGMA foreign_keys = ON;

-- Cache size (10MB)
PRAGMA cache_size = -10000;
```

## Schema Version Table

Tracks the current schema version for migrations.

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL,
  description TEXT
);
```

### Fields
- **version** (INTEGER, PRIMARY KEY): Schema version number (1, 2, 3, ...)
- **applied_at** (TEXT, NOT NULL): ISO 8601 timestamp when version was applied
- **description** (TEXT): Human-readable description of schema version

### Initial Data
```sql
INSERT INTO schema_version (version, applied_at, description)
VALUES (1, '2025-12-02T00:00:00.000Z', 'Initial schema with events table');
```

## Events Table

Stores all operator events with full indexing for efficient queries.

```sql
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
```

### Fields

#### id (TEXT, PRIMARY KEY)
- **Format**: `evt_YYYYMMDD_HHMMSS_<random>`
- **Example**: `evt_20251202_103045_a7f3b9`
- **Purpose**: Globally unique, sortable identifier
- **Generation**: `generateEventId()` function
- **Constraints**: Must be unique, not null

#### event_type (TEXT, NOT NULL)
- **Values**: `'cluster'`, `'operator'`, `'insight'`, `'assessment'`, `'health'`, `'system'`
- **Purpose**: Categorize events by source system
- **Indexed**: Yes (idx_events_type)
- **Constraints**: Must be one of allowed values

#### severity (TEXT, NOT NULL)
- **Values**: `'info'`, `'warning'`, `'error'`, `'critical'`
- **Purpose**: Indicate event importance for filtering and alerting
- **Indexed**: Yes (idx_events_severity)
- **Constraints**: Must be one of allowed values

#### title (TEXT, NOT NULL)
- **Purpose**: Short, human-readable event summary
- **Max Length**: 200 characters (recommended)
- **Example**: "Operator started", "Missing resource limits"

#### description (TEXT, NULLABLE)
- **Purpose**: Detailed event information
- **Max Length**: 1000 characters (recommended)
- **Example**: "Operator v1.0.0 started in free tier with 4Gi memory"

#### object_kind (TEXT, NULLABLE)
- **Purpose**: Kubernetes resource kind the event relates to
- **Examples**: `'Deployment'`, `'Pod'`, `'Node'`, `'Namespace'`
- **Indexed**: Yes (composite idx_events_object)

#### object_namespace (TEXT, NULLABLE)
- **Purpose**: Kubernetes namespace of the referenced object
- **Examples**: `'default'`, `'kube9-system'`, `'production'`
- **Indexed**: Yes (composite idx_events_object)
- **Note**: NULL for cluster-scoped resources (Node, Namespace, etc.)

#### object_name (TEXT, NULLABLE)
- **Purpose**: Name of the referenced Kubernetes object
- **Examples**: `'nginx'`, `'postgres-db'`, `'worker-3'`
- **Indexed**: Yes (composite idx_events_object)

#### metadata (TEXT, NULLABLE)
- **Purpose**: Additional structured data as JSON
- **Format**: Valid JSON object
- **Max Size**: 10KB (recommended)
- **Example**:
```json
{
  "version": "1.0.0",
  "tier": "free",
  "collection_id": "coll_123",
  "resources_collected": 150
}
```

#### created_at (TEXT, NOT NULL)
- **Format**: ISO 8601 timestamp with milliseconds
- **Example**: `2025-12-02T10:30:45.123Z`
- **Purpose**: Event creation timestamp
- **Indexed**: Yes (idx_events_created)
- **Constraints**: Must be valid ISO 8601 string

## Indexes

### idx_events_type
Speeds up queries filtering by event type.

```sql
CREATE INDEX IF NOT EXISTS idx_events_type 
ON events(event_type);
```

**Usage**: `SELECT * FROM events WHERE event_type = 'operator'`

### idx_events_severity
Speeds up queries filtering by severity level.

```sql
CREATE INDEX IF NOT EXISTS idx_events_severity 
ON events(severity);
```

**Usage**: `SELECT * FROM events WHERE severity = 'critical'`

### idx_events_created
Speeds up queries sorting by creation time and date range filtering.

```sql
CREATE INDEX IF NOT EXISTS idx_events_created 
ON events(created_at DESC);
```

**Usage**: 
- `SELECT * FROM events ORDER BY created_at DESC`
- `SELECT * FROM events WHERE created_at >= ? AND created_at < ?`

### idx_events_object
Speeds up queries filtering by Kubernetes object references.

```sql
CREATE INDEX IF NOT EXISTS idx_events_object 
ON events(object_kind, object_namespace, object_name);
```

**Usage**: 
- `SELECT * FROM events WHERE object_kind = 'Deployment' AND object_name = 'nginx'`
- `SELECT * FROM events WHERE object_kind = 'Pod' AND object_namespace = 'default'`

## Query Patterns

### List All Events (Newest First)
```sql
SELECT * FROM events 
ORDER BY created_at DESC 
LIMIT 50;
```

### Filter by Event Type
```sql
SELECT * FROM events 
WHERE event_type = ? 
ORDER BY created_at DESC;
```

### Filter by Severity
```sql
SELECT * FROM events 
WHERE severity = ? 
ORDER BY created_at DESC;
```

### Filter by Date Range
```sql
SELECT * FROM events 
WHERE created_at >= ? AND created_at < ? 
ORDER BY created_at DESC;
```

### Filter by Object Reference
```sql
SELECT * FROM events 
WHERE object_kind = ? 
  AND object_namespace = ? 
  AND object_name = ? 
ORDER BY created_at DESC;
```

### Combined Filters with Pagination
```sql
SELECT * FROM events 
WHERE event_type = ? 
  AND severity IN (?, ?) 
  AND created_at >= ? 
ORDER BY created_at DESC 
LIMIT ? OFFSET ?;
```

### Get Single Event by ID
```sql
SELECT * FROM events 
WHERE id = ?;
```

### Count Events by Type
```sql
SELECT event_type, COUNT(*) as count 
FROM events 
GROUP BY event_type;
```

### Retention Cleanup Query
```sql
-- Delete info/warning events older than 7 days
DELETE FROM events 
WHERE severity IN ('info', 'warning') 
  AND created_at < datetime('now', '-7 days');

-- Delete error/critical events older than 30 days
DELETE FROM events 
WHERE severity IN ('error', 'critical') 
  AND created_at < datetime('now', '-30 days');
```

## Schema Migrations

### Migration Strategy

1. **Detect Version Mismatch**: On startup, read current version from `schema_version` table
2. **Execute Migrations**: Run all migrations from current version to target version sequentially
3. **Update Version**: Insert new row in `schema_version` table after successful migration
4. **Error Handling**: If migration fails, log error and prevent operator startup

### Example Migration: V1 → V2

Suppose v2 adds an `acknowledged` field to events table.

```sql
-- Migration: V1 to V2
-- Add acknowledged field to events table

-- Step 1: Add new column (default false)
ALTER TABLE events ADD COLUMN acknowledged INTEGER DEFAULT 0;

-- Step 2: Create index for acknowledged field
CREATE INDEX IF NOT EXISTS idx_events_acknowledged 
ON events(acknowledged);

-- Step 3: Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (2, datetime('now'), 'Added acknowledged field to events table');
```

### Migration Implementation

```typescript
interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
}

const migrations: Migration[] = [
  {
    version: 2,
    description: 'Add acknowledged field',
    up: (db) => {
      db.exec('ALTER TABLE events ADD COLUMN acknowledged INTEGER DEFAULT 0');
      db.exec('CREATE INDEX idx_events_acknowledged ON events(acknowledged)');
      db.prepare('INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)')
        .run(2, new Date().toISOString(), 'Added acknowledged field');
    }
  }
];
```

## Data Types and Validation

### Event Type Enum
```typescript
type EventType = 'cluster' | 'operator' | 'insight' | 'assessment' | 'health' | 'system';
```

### Severity Enum
```typescript
type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';
```

### Event Schema (Zod)
```typescript
import { z } from 'zod';

const EventSchema = z.object({
  id: z.string().regex(/^evt_\d{8}_\d{6}_[a-z0-9]{6}$/),
  event_type: z.enum(['cluster', 'operator', 'insight', 'assessment', 'health', 'system']),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  title: z.string().max(200),
  description: z.string().max(1000).optional(),
  object_kind: z.string().optional(),
  object_namespace: z.string().optional(),
  object_name: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
});

type Event = z.infer<typeof EventSchema>;
```

## Database Maintenance

### VACUUM Operation
Run periodically to reclaim space from deleted events.

```sql
-- Should be run during maintenance windows (low load)
VACUUM;
```

**Frequency**: Weekly or after large deletions (retention cleanup)

### Database Integrity Check
```sql
PRAGMA integrity_check;
```

**Frequency**: Daily (quick) or weekly (full)

### Database Size Query
```sql
SELECT page_count * page_size as size 
FROM pragma_page_count(), pragma_page_size();
```

## Performance Characteristics

### Expected Sizes
- **Empty Database**: ~20KB
- **Per Event**: ~100 bytes (without metadata)
- **10,000 Events**: ~1MB
- **100,000 Events**: ~10MB
- **1,000,000 Events**: ~100MB

### Query Performance Targets
- **Insert Single Event**: < 1ms
- **Select by ID**: < 1ms
- **Select 100 events (indexed filter)**: < 10ms
- **Count by type**: < 5ms
- **Retention cleanup (1000 deletes)**: < 100ms

## Backup and Recovery

### Backup Strategy
1. **Online Backup**: Copy `/data/kube9.db` and `/data/kube9.db-wal` while operator is running
2. **WAL Mode**: Ensures consistency during backup
3. **Frequency**: Daily snapshots, retain for 7 days

### Recovery Strategy
1. Stop operator
2. Replace `/data/kube9.db` with backup
3. Delete WAL files (`.db-wal`, `.db-shm`)
4. Start operator (will verify schema version)

## Security Considerations

### Sensitive Data Prevention
- **Never store**: Passwords, tokens, secrets, API keys in events
- **Sanitize**: Metadata should be scrubbed of sensitive values
- **Redaction**: Automatically redact fields with sensitive names

### Access Control
- **Database file**: Readable only by operator pod
- **CLI queries**: Protected by Kubernetes RBAC (pods/exec permission)
- **No network exposure**: Database is local-only

## Monitoring

### Database Health Metrics
```typescript
// Expose via Prometheus /metrics endpoint
kube9_events_storage_size_bytes
kube9_database_operations_total{operation="insert|select|delete"}
kube9_database_query_duration_seconds
kube9_events_retention_cleanup_last_run_timestamp
kube9_events_retention_cleanup_events_deleted
```

## Testing

### Schema Tests
- Verify table creation on empty database
- Verify indexes exist and are used
- Verify schema version tracking

### Migration Tests
- Test V1 → V2 migration with existing data
- Test migration rollback on failure
- Test migration with large datasets

### Data Integrity Tests
- Verify PRIMARY KEY constraint on event IDs
- Verify NOT NULL constraints on required fields
- Verify foreign key enforcement (if added)

### Performance Tests
- Insert 1000 events, measure time
- Query 100 events with filters, measure time
- Delete 1000 events (retention), measure time

