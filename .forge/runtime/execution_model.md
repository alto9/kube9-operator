# Execution Model

## Dual-Mode Binary
- **serve** (default): Operator loop, assessments, event recording
- **query**: CLI mode for data access via kubectl exec

## Node.js 22
- Single process
- Synchronous SQLite (better-sqlite3, no async DB)

## Reconcile Loop
- Status update every 60s
- Collection scheduler with randomized timing
- Event watcher (Kubernetes Events)
