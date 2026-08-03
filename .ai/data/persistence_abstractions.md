# Persistence Abstractions

## Storage Strategy

**Dual storage**:
- **ConfigMap**: Status only. Simple, cacheable, backward compatible.
- **SQLite**: Events, assessments, collections (five `CollectionPayload` types, no CRDs), ArgoCD data (M9), and Kubernetes AI Conformance readiness runs (M10). Rich queries via CLI.

## Kubernetes AI Conformance Persistence

Kubernetes AI Conformance uses SQLite as the durable store and the status ConfigMap as the bounded client surface.

- Checklist inputs are bundled or synced into the operator package with a recorded source revision or bundle identifier.
- Each run records the selected Kubernetes minor, selected checklist version, final lifecycle state, aggregate counts, and bounded failure text.
- Per-requirement results are stored separately from the run record so CLI and future diagnostics can query by category, status, level, or requirement id.
- The status writer publishes only the latest completed or failed run summary under `OperatorStatus.aiConformance`; it does not publish unbounded evidence payloads.
- Requirements that cannot be objectively evaluated from Kubernetes API or existing persisted signals are stored as `not-evaluated` or `needs-evidence`, not inferred.

## SQLite Configuration

### Database Path

- **Default path**: `/data/kube9.db`
- **Configurable via**: `DB_PATH` environment variable (specifies directory, filename is always `kube9.db`)
- **Production**: Mounted PersistentVolumeClaim at `/data`
- **Development**: Uses `DB_PATH` or defaults to `/data` (directory created if missing)

### Database Library

- **Library**: `better-sqlite3` (synchronous, single-process)
- **Connection**: Singleton pattern via `DatabaseManager.getInstance()`
- **Threading**: Single connection per process (better-sqlite3 is synchronous)

### SQLite Pragmas

Configured automatically on database initialization:

- **WAL mode**: `journal_mode = WAL` - Write-Ahead Logging for better concurrency
- **Synchronous**: `synchronous = NORMAL` - Balance between durability and performance
- **Foreign keys**: `foreign_keys = ON` - Enforce referential integrity
- **Cache size**: `cache_size = -10000` - 10MB page cache (negative value = KB)

### PersistentVolumeClaim (PVC)

Helm chart configuration:

- **Enabled by default**: `events.persistence.enabled = true`
- **Default size**: `5Gi` (configurable via `events.persistence.size`)
- **Storage class**: Uses cluster default if not specified (`events.persistence.storageClassName`)
- **Access mode**: `ReadWriteOnce` (single pod access)
- **Mount path**: `/data` (volume name: `data`)

When persistence is disabled (`events.persistence.enabled = false`), uses `emptyDir` volume (ephemeral, lost on pod restart).

### Durable history for agent / Desktop consumers

Queryable event, assessment, and collection history for Desktop Tier 2 (and similar agents) assumes chart-default PVC-backed SQLite at `/data/kube9.db`. With `emptyDir` (persistence disabled) or a missing/unhealthy operator, treat history as degraded or absent: empty results are expected, not a store failure to invent. Desktop does not own a peer durable ledger of operator rows. Retention semantics for still-stored rows are in [consistency.md](consistency.md): events are severity-split time-pruned; **assessments**, **`assessment_history`**, and **`collections`** have no time-based TTL and collections have no count-based cap (explicit remove / operational cleanup only). Operator SQLite does not store pod/workload logs.

### Collections persistence boundary

- **Store:** Existing SQLite `collections` table via `CollectionRepository` (append-only inserts). No CRDs, no phone-home / kube9-api sync, no second persistence engine.
- **Queryable truth:** `query collections list|get` and status `collectionsStoredCount` reflect durable SQLite rows (`CollectionRepository.countCollections`).
- **Sole durable write:** Collectors persist only through `CollectionRepository.insertCollection` (Zod validate then insert). In-memory `LocalStorage` is not durable truth, must not update `collectionsStoredCount`, and is removed from the collector durable write path.
- **Types:** `cluster-metadata`, `resource-inventory`, `resource-configuration-patterns`, `performance-metrics`, `security-posture`.
- **Producer ownership:** Operator owns normative write shapes. Peer Desktop foreshadows are non-normative.

## Open implementation decisions

### Resolved (single durable write path)

Collectors (existing three and the two additive types) write through `CollectionRepository.insertCollection`. LocalStorage is off the durable path. See [data_model.md](data_model.md).

### Degrade persistence — peer collector scope

Whether Prometheus-unavailable performance ticks omit rows, persist `source.available: false` success payloads, or fail without a row is owned by the performance-metrics collector capability (coordinate with runtime / integration).

### Optional future prune/cap

Not in contract now; if introduced later, align Helm/env, `RetentionCleanup` (or peer service), and consumer prose via `/refine-issue`.

## Single Binary, Dual Modes

```
kube9-operator
├── serve (default)  → Operator loop, assessments, event recording, writes to SQLite
└── query            → CLI reads from SQLite via kubectl exec
```

Extensions use `kubectl exec` to run `kube9-operator query <command>` inside the operator pod.

## Migration from ConfigMap

- Phase 1: ConfigMap status (current)
- Phase 2: SQLite + CLI alongside ConfigMap
- Phase 3: Deprecate ConfigMap for rich data; CLI primary
- Phase 4: Remove ConfigMap code (status may remain for simplicity)
