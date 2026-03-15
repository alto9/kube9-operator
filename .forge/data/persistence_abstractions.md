# Persistence Abstractions

## Storage Strategy

**Dual storage**:
- **ConfigMap**: Status only. Simple, cacheable, backward compatible.
- **SQLite**: Events, assessments, ArgoCD data (M9). Rich queries via CLI.

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
