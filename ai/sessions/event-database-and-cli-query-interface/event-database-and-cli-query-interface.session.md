---
session_id: event-database-and-cli-query-interface
start_time: '2025-12-02T01:40:06.639Z'
status: development
problem_statement: Event Database and CLI Query Interface
changed_files:
  - path: ai/features/event-system/event-database-storage.feature.md
    change_type: added
    scenarios_added:
      - Initialize database on first run
      - Use existing database on subsequent runs
      - Store event in database
      - Store event with object reference
      - Store event with JSON metadata
      - Prevent duplicate event IDs
      - Query events by type
      - Query events by severity
      - Query events by date range
      - Query events by object reference
      - Automatic retention cleanup for info events
      - Retain critical events for 30 days
      - Retention cleanup runs on schedule
      - Database size monitoring
      - Database health check
      - Handle database corruption gracefully
      - Database migrations for schema changes
      - Concurrent reads during writes
      - Database backup considerations
  - path: ai/features/event-system/cli-query-interface.feature.md
    change_type: added
    scenarios_added:
      - Run operator in serve mode (default)
      - Run operator in serve mode explicitly
      - Query operator status via CLI
      - List all events via CLI
      - Filter events by type
      - Filter events by severity
      - Filter events by date range
      - Filter events by object reference
      - Combine multiple filters
      - Paginate event results
      - Get single event by ID
      - Get non-existent event returns error
      - Output events in JSON format (default)
      - Output events in YAML format
      - Output events in table format for humans
      - VS Code extension queries events
      - CLI validates arguments before querying
      - CLI handles database connection failures
      - CLI query timeout protection
      - Multiple simultaneous CLI queries
      - CLI includes version information
      - CLI displays help information
      - RBAC enforcement by Kubernetes
      - CLI performance for large result sets
      - CLI handles special characters in object names
  - path: ai/features/event-system/event-emission.feature.md
    change_type: added
    scenarios_added:
      - Emit operator startup event
      - Emit operator shutdown event
      - Emit registration success event
      - Emit registration failure event
      - Emit health transition event (healthy → degraded)
      - Emit health transition event (degraded → unhealthy)
      - Emit collection started event
      - Emit collection completed event
      - Emit collection failed event
      - Emit insight generated event
      - Emit assessment completed event
      - Emit critical security finding event
      - Emit cluster event for node added
      - Emit system error event
      - Event emission is non-blocking
      - Background worker processes event queue
      - Event queue overflow protection
      - Generate sortable event IDs
      - Event IDs sort chronologically
      - Prometheus metrics for event emission
      - Event metadata size limits
      - Sanitize sensitive data in events
      - Event emission during operator shutdown
      - Event emission performance target
      - Event emission during database unavailability
      - Bulk event emission for collection results
      - Record Kubernetes Event for Pod failure
      - Record Kubernetes Event for Node NotReady
      - Record Node added to cluster
      - Record Namespace deletion
      - Record Deployment scaled up
      - Record ImagePullBackOff event
      - Record CrashLoopBackOff event
      - Watch and record Kubernetes Events continuously
      - Filter duplicate Kubernetes Events
      - Correlate events with operator insights
      - Record ResourceQuota exceeded event
      - Record PersistentVolumeClaim binding failure
      - Record OOMKilled container event
      - Record HPA scaling event
      - Record Service endpoint changes
      - Record operator lifecycle events as supplementary context
      - Record operator health changes as supplementary context
      - Event recording is non-blocking
      - Generate sortable event IDs for recorded events
      - Prometheus metrics for event recording
      - Event metadata size limits for recorded events
      - Sanitize sensitive data in recorded events
      - Event recording during operator shutdown
      - Event recording performance target
      - Event recording during database unavailability
      - Handle Kubernetes watch connection failures
    scenarios_modified:
      - Event recording is non-blocking
      - Background worker processes event queue
      - Event queue overflow protection
      - Event IDs sort chronologically
    scenarios_removed:
      - Emit operator startup event
      - Emit operator shutdown event
      - Emit registration success event
      - Emit registration failure event
      - Emit health transition event (healthy → degraded)
      - Emit health transition event (degraded → unhealthy)
      - Emit collection started event
      - Emit collection completed event
      - Emit collection failed event
      - Emit insight generated event
      - Emit assessment completed event
      - Emit critical security finding event
      - Emit cluster event for node added
      - Emit system error event
      - Event emission is non-blocking
      - Generate sortable event IDs
      - Prometheus metrics for event emission
      - Event metadata size limits
      - Sanitize sensitive data in events
      - Event emission during operator shutdown
      - Event emission performance target
      - Event emission during database unavailability
      - Bulk event emission for collection results
start_commit: 85d7c3a937487b316f7b3ca063d80b7dbd026cfa
end_time: '2025-12-02T02:00:25.837Z'
---
## Problem Statement

Add comprehensive event tracking system to the kube9-operator, storing events in a SQLite database and exposing them through a new CLI query interface. This enables the VS Code extension and web UI to provide an Event Viewer interface for cluster administrators and developers.

Currently, the operator tracks various activities (insights, assessments, health checks, collections) but doesn't provide a unified event history. Users need to:
- View historical events to understand what happened in their cluster
- Troubleshoot past issues by reviewing event timelines
- Audit operator activities and cluster state changes
- Filter events by type, severity, date range, and affected objects

## Goals

1. **Event Storage**: Implement SQLite database for persistent event storage with proper schema versioning and migrations
2. **CLI Infrastructure**: Create CLI command routing system supporting `serve` (operator loop) and `query` (data access) modes
3. **Event Emission**: Instrument all key operator lifecycle points to emit structured events
4. **Query Interface**: Provide rich query capabilities with filtering, pagination, and multiple output formats (JSON, YAML, table)
5. **Retention Management**: Automatic cleanup of old events based on configurable retention policies (7 days default, 30 days for critical)
6. **Extension Integration**: Enable VS Code extension to query events via kubectl exec with proper RBAC
7. **Zero Performance Impact**: Event system should have negligible impact on operator performance (< 1ms per event)

## Approach

### Technology Choices

**SQLite with better-sqlite3**:
- Synchronous SQLite for Node.js (simpler than async, suitable for single-process operator)
- WAL (Write-Ahead Logging) mode for better concurrency
- Database location: `/data/kube9.db` on PersistentVolume
- Schema versioning table for migrations

**CLI Framework**:
- `commander` npm package for CLI routing and argument parsing
- `zod` for runtime type validation of CLI arguments and query results
- Binary supports multiple commands: `serve` (default), `query status`, `query events list`, `query events get`

**Event ID Strategy**:
- Format: `evt_YYYYMMDD_HHMMSS_<random>` (e.g., `evt_20251202_103045_a7f3b9`)
- Benefits: Natural chronological sorting, human-readable timestamps, collision resistance

### Architecture

**Dual Storage Strategy**:
- **ConfigMap**: Keep for basic status (backward compatibility with existing extensions)
- **SQLite + CLI**: Use for events, insights, assessments, ArgoCD data (rich queries)
- Extensions can query ConfigMap (simple) OR CLI (advanced features)

**Event Flow**:
1. Operator code emits events via `EventEmitter.emit()`
2. EventEmitter adds to async queue (non-blocking)
3. Background worker processes queue and writes to SQLite
4. CLI queries read from SQLite and return formatted results
5. Extensions exec into pod and run CLI queries via kubectl

**Database Schema**:
- `schema_version` table for migrations
- `events` table with indexed columns: event_type, severity, created_at, object references
- Indexes on type, severity, timestamp, and object kind/namespace/name for fast queries

### Implementation Phases

**Phase 0: CLI Infrastructure Foundation**
- Install dependencies (better-sqlite3, commander, zod)
- Update Dockerfile for native module compilation
- Create CLI entry point with command routing
- Implement `serve` and `query` top-level commands

**Phase 1: Database & Storage**
- Implement DatabaseManager class with connection management
- Create schema initialization and versioning
- Add events table to SQLite schema
- Implement event storage layer
- Add event retention cleanup job

**Phase 2: CLI Query Interface**
- Implement `query status` command
- Implement `query events list` with filtering
- Implement `query events get` for single event
- Add pagination support and output formats

**Phase 3: Event Emission**
- Create EventEmitter service with async queue
- Instrument operator lifecycle events (startup, shutdown, restart)
- Instrument registration events (success, failure)
- Instrument collection events (start, complete, failure)
- Instrument health transition events
- Add Prometheus metrics for event system

**Phase 4: Testing & Documentation**
- End-to-end integration tests
- Performance benchmarking (1000 events/sec target)
- RBAC documentation for extensions
- CLI usage documentation

## Key Decisions

### Decision 1: SQLite over PostgreSQL or MongoDB
**Rationale**: 
- Single-process operator doesn't need client-server database
- SQLite is embedded, zero-configuration, and perfect for local storage
- Significantly reduces operational complexity
- Excellent performance for read-heavy workloads
- WAL mode provides good concurrency for operator + CLI queries

### Decision 2: Synchronous better-sqlite3 over async sqlite3
**Rationale**:
- Operator is single-process, synchronous DB operations are simpler
- No callback hell or promise chains for database operations
- Better performance for small transactions
- Easier to reason about transaction boundaries

### Decision 3: CLI-based querying over HTTP API
**Rationale**:
- No need to expose HTTP endpoints (reduces attack surface)
- Extensions can use kubectl exec (standard Kubernetes pattern)
- No authentication needed beyond Kubernetes RBAC
- Simpler to implement and maintain
- Follows Kubernetes patterns (like `kubectl exec redis-cli`)

### Decision 4: Timestamp-based Event IDs
**Rationale**:
- Natural chronological sorting in database and UIs
- Human-readable for debugging and logs
- No need for auto-increment (which complicates migrations)
- 6-char random suffix prevents collisions

### Decision 5: Keep ConfigMap for Status, Add SQLite for Events
**Rationale**:
- Backward compatibility with existing extensions
- ConfigMap remains simple, fast, and cacheable
- SQLite enables rich event queries without ConfigMap bloat
- Clear separation: status (current state) vs events (history)

### Decision 6: Async Event Queue
**Rationale**:
- Event emission must not block operator logic
- Queue absorbs bursts of events without performance impact
- Background worker can batch writes for efficiency
- Enables retry logic for transient failures

### Decision 7: Two-Tier Retention Policy (7/30 days)
**Rationale**:
- 7 days for info/warning events (typical troubleshooting window)
- 30 days for error/critical events (compliance and auditing)
- Configurable via Helm values for different use cases
- Automatic cleanup prevents unbounded database growth

## Notes

### Performance Considerations
- Target: < 1ms per event emission (including queue insertion)
- Target: 1000 events/sec throughput
- Database size: ~1MB per 10,000 events (estimated)
- Periodic VACUUM during maintenance windows

### RBAC Requirements for Extensions
Extensions need permission to exec into operator pod:
```yaml
rules:
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
```

### Free Tier vs Pro Tier
- Event system is **free tier** - no API key required
- Events are **local only** - never sent to kube9-server
- Pro tier may add: AI-powered insights from events, multi-cluster aggregation

### Migration Strategy
- Phase 0-1 can be developed without breaking existing operator functionality
- CLI can be tested independently of operator loop
- Event emission can be added incrementally (one subsystem at a time)
- Extensions continue to work with ConfigMap until CLI integration is ready

### Security Considerations
- SQLite database is local to operator pod (not exposed)
- CLI queries require pod exec permissions (standard Kubernetes security)
- Events should never contain sensitive data (passwords, tokens, secrets)
- Implement event metadata sanitization for user-provided values

### Testing Strategy
- Unit tests: Database operations, CLI parsing, event recording, Kubernetes watch handling
- Integration tests: End-to-end event flow (K8s Event → recording → storage → query), CLI queries against real DB
- Performance tests: Event recording throughput, query response time, database size growth
- Load tests: Concurrent CLI queries during high event volume from cluster

## Corrections Made

### Correction 1: Event Recording vs Event Emission (2025-12-02)
**Issue**: Initial documentation focused too heavily on the operator **emitting** its own lifecycle events rather than **recording** events from external sources (Kubernetes Events, cluster changes).

**Correction**: Updated all features, specs, and diagrams to emphasize:
- **Primary purpose**: Recording Kubernetes Events (Pod failures, node issues, etc.) and cluster resource changes
- **Secondary purpose**: Recording operator-generated insights and assessments
- **Supplementary**: Recording operator lifecycle events as context

**Key Changes**:
- Renamed feature focus from "event emission" to "event recording"
- Updated scenarios to focus on watching Kubernetes Events via Watch API
- Added Kubernetes Informers for resource change detection
- Added event filtering (only record significant events, not all K8s events)
- Updated architecture diagrams to show Kubernetes as primary event source
- Clarified that operator lifecycle events provide context but are not the main purpose
