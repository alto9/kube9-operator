# Data Consistency

## Transaction Handling

### better-sqlite3 Transaction Model

The codebase uses `better-sqlite3`, a synchronous SQLite library. Each prepared statement execution is atomic:

- **No explicit transactions**: Individual `stmt.run()` calls are atomic operations
- **ACID guarantees**: SQLite provides ACID compliance at the statement level
- **Concurrent reads**: WAL mode enables concurrent readers while writes occur
- **Single writer**: better-sqlite3 uses a single connection per process, ensuring no concurrent writes

### Foreign Key Constraints

Foreign keys are enforced at the database level:

- **Enabled**: `PRAGMA foreign_keys = ON` (set on database initialization)
- **Cascade deletes**: `assessment_history` rows are automatically deleted when parent `assessments` row is deleted (`ON DELETE CASCADE`)
- **Referential integrity**: Prevents orphaned records in `assessment_history`

### Upsert Operations

Assessment runs use `INSERT ... ON CONFLICT DO UPDATE` for idempotent updates:

- **Atomic upsert**: Single statement handles both insert and update cases
- **Conflict resolution**: Updates existing row if `run_id` already exists
- **Partial updates**: Uses `COALESCE` to preserve existing timestamps when appropriate

## Migration System

### Schema Versioning

Database schema is versioned and managed through migrations:

- **Version tracking**: `schema_version` table records applied migrations
- **Current version**: `LATEST_SCHEMA_VERSION = 2` (defined in `src/database/schema.ts`)
- **Migration execution**: Migrations run automatically on database initialization
- **Idempotent**: Schema initialization can be called multiple times safely

### Migration Process

1. **Initialization**: `SchemaManager.initialize()` is called on startup
2. **Version detection**: Reads current version from `schema_version` table (0 if new database)
3. **Migration execution**: Applies all migrations from `(currentVersion, LATEST_SCHEMA_VERSION]`
4. **Version recording**: Each migration records its version, timestamp, and description

### Schema Versions

- **Version 1**: Initial schema with `events` table
- **Version 2**: Added `assessments` and `assessment_history` tables with indexes

## Data Retention Policies

### Event Retention

Events are automatically cleaned up based on severity and age:

- **Configuration**: Set via Helm values (`events.retention.infoWarning`, `events.retention.errorCritical`) or environment variables
- **Default retention**:
  - Info/Warning events: 7 days
  - Error/Critical events: 30 days
- **Cleanup schedule**: Runs every 6 hours via `RetentionCleanup` service
- **Immediate execution**: Cleanup runs immediately on service start, then on schedule

### Retention Cleanup Implementation

- **Service**: `RetentionCleanup` class in `src/database/retention-cleanup.ts`
- **Scheduled job**: Runs every 6 hours (`6 * 60 * 60 * 1000` milliseconds)
- **Deletion queries**: Separate queries for info/warning vs error/critical events
- **Logging**: Logs number of events deleted per cleanup run

### Configuration Sources

Retention days can be configured via:

1. **Helm values** (`charts/kube9-operator/values.yaml`):
   ```yaml
   events:
     retention:
       infoWarning: 7
       errorCritical: 30
   ```

2. **Environment variables** (set by Helm chart):
   - `EVENT_RETENTION_INFO_WARNING_DAYS` (default: 7)
   - `EVENT_RETENTION_ERROR_CRITICAL_DAYS` (default: 30)

3. **Config interface** (`src/config/types.ts`):
   - `eventRetentionInfoWarningDays`
   - `eventRetentionErrorCriticalDays`

## Data Lifecycle Phases

### Phase 1: Raw Data Collection (Current)
- M8 data collectors gather raw data from cluster resources
- Stored locally in operator pod
- No data leaves cluster

## Design Principles

- **Separation of concerns**: Collection and storage have distinct responsibility
- **Privacy by default**: Raw data never leaves cluster
- **ACID compliance**: SQLite provides transaction guarantees
- **Referential integrity**: Foreign keys ensure data consistency
- **Automatic cleanup**: Retention policies prevent unbounded growth
