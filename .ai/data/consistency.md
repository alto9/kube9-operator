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

### Agent and Desktop consumers of event history

Desktop Pro debugging (and other agent tooling) that reads operator event history via the existing query CLI may treat the **severity-split defaults above (7 / 30 days)** as the **advertised consumer retention window**:

- After prune, matching event rows are gone. Operator history cannot recover pruned events.
- There is no single fixed “N days” in the data plane. Severity selects the band. Product surfaces that say “retained N days” must map to this split (or state both bands), not invent a third window.
- Overrides via Helm/env change the effective store window. Consumers that need a hard bound should filter with `--since` / `--until` against still-stored rows, not assume a SLA beyond what remains after cleanup.
- Empty or partial event history (prune, operator absent, persistence disabled / ephemeral volume) is a normal gap for history consumers. Live cluster reads remain the debugging baseline outside this store.

### Assessment retention (no time-based TTL)

`assessments` and `assessment_history` are **not** time-pruned by `RetentionCleanup` or any assessment TTL:

- Rows persist until an explicit remove or parent cascade (`assessment_history` follows `assessments` via `ON DELETE CASCADE`).
- Agent and Desktop consumers of `query assessments history` (and related assessment query paths) may rely **only on whatever is still stored**. Empty or partial assessment history is a normal gap, not a retention SLA.
- This epic does **not** introduce an assessment TTL or a product retention window for assessment rows.

### Collections retention (no time-based TTL, no count-based cap)

`collections` rows are **not** time-pruned by `RetentionCleanup` and have **no** count-based eviction in this product surface:

- Rows persist until explicit remove or operational cleanup (same class as assessments).
- Append-only collectors (including ~15m `performance-metrics`) may grow the table; growth is an operational concern, not a product TTL or max-row SLA.
- Agent and Desktop consumers of `query collections list|get` may rely **only on whatever is still stored**. Empty or partial collection history is a normal gap, not a retention window.
- This initiative does **not** introduce per-type or global TTL windows, nor a durable max-row cap analogous to the historical in-memory `LocalStorage` buffer.
- Query JSON does not expose retention metadata (same stance as events/assessments).

### Log storage (out of scope)

The operator SQLite model does **not** store pod or workload container logs. There is no log table, log retention policy, or pruned-log recovery path in this data plane. Log evidence for debugging agents comes from live Kubernetes API reads (Desktop Tier 1), not from operator history.

### Retention Cleanup Implementation

- **Service**: `RetentionCleanup` class in `src/database/retention-cleanup.ts`
- **Scheduled job**: Runs every 6 hours (`6 * 60 * 60 * 1000` milliseconds)
- **Deletion queries**: Separate queries for info/warning vs error/critical events (events table only)
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
- **Automatic cleanup**: Event retention policies prevent unbounded growth of the events table; assessments and collections rely on explicit remove / cascade (or operational cleanup), not time prune or count-based eviction

## Open implementation decisions

- **Assessment prune policy (if ever introduced):** days-by-severity or single window; whether prune targets `assessments` only (cascade history) vs both tables; cleanup schedule alignment with `RetentionCleanup`; Helm/env knobs and migration of consumer prose. Not product-committed now. Resolve via `/refine-issue` if a future epic adds TTL.
- **Collections prune / cap policy (if ever introduced):** time window (global or per-type), count-based eviction, Helm/env knobs, indexes used for delete, and whether `collectionsStoredCount` reflects post-prune totals. Not product-committed now; current contract is no TTL and no count cap. Resolve via `/refine-issue` if a future epic adds either.

### Resolved (event retention consumer bounds)

Event and assessment query JSON **does not** expose effective retention windows, configured day counts, or query “as of” prune bounds. Agent and Desktop consumers filter with `--since` / `--until` (ISO-8601 on the operator CLI) against **still-stored** rows after `RetentionCleanup`. Helm/env overrides change the effective store window but are not echoed as result metadata in this product surface. A future additive operator epic may introduce optional metadata; that is not committed here.

### Resolved (collections retention)

Collections use assessments-class retention: **no time-based TTL** and **no count-based cap** in this initiative. Consumers read still-stored rows only. Retention metadata is not added to collections list/get JSON.
