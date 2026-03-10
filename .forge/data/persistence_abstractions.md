# Persistence Abstractions

## Storage Strategy

**Dual storage**:
- **ConfigMap**: Status only. Simple, cacheable, backward compatible.
- **SQLite**: Events, assessments, ArgoCD data (M9). Rich queries via CLI.

## SQLite

- **Path**: `/data/kube9.db`
- **Mount**: PersistentVolumeClaim at `/data`
- **Mode**: WAL (Write-Ahead Logging) for concurrency
- **Library**: better-sqlite3 (synchronous, single-process)

## Single Binary, Dual Modes

```
kube9-operator
├── serve (default)  → Operator loop, assessments, event recording, writes to SQLite
└── query            → CLI reads from SQLite via kubectl exec
```

Extensions use `kubectl exec` to run `kube9-operator query <command>` inside the operator pod.

## PVC Configuration

Helm chart creates PVC for event/assessment persistence. Default 5Gi for events; 1Gi sufficient for status-only.

## Migration from ConfigMap

- Phase 1: ConfigMap status (current)
- Phase 2: SQLite + CLI alongside ConfigMap
- Phase 3: Deprecate ConfigMap for rich data; CLI primary
- Phase 4: Remove ConfigMap code (status may remain for simplicity)
