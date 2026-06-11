# Persistence Abstractions

## Storage Strategy

**Dual storage**:
- **ConfigMap**: Status only. Simple, cacheable, backward compatible.
- **SQLite**: Events, assessments, ArgoCD data (M9), and Kubernetes AI Conformance readiness runs (M10). Rich queries via CLI.

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
