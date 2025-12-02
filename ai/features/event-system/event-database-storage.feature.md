---
feature_id: event-database-storage
spec_id: [event-database-schema-spec, database-manager-spec]
context_id: [nodejs-sqlite]
---

# Event Database Storage Feature

## Overview

The operator must store events persistently in a SQLite database with proper schema versioning, migrations, and retention management. The database provides the foundation for historical event queries and audit trails.

## Behavior

```gherkin
Feature: Event Database Storage

Background:
  Given the operator has a PersistentVolume mounted at /data
  And the operator uses SQLite database at /data/kube9.db
  And the database uses WAL (Write-Ahead Logging) mode

Scenario: Initialize database on first run
  Given the database file does not exist at /data/kube9.db
  When the operator starts
  Then it should create a new SQLite database
  And it should enable WAL mode for concurrency
  And it should create the schema_version table
  And it should create the events table with indexes
  And it should record schema version 1 in schema_version table
  And it should log "Database initialized successfully"

Scenario: Use existing database on subsequent runs
  Given the database file exists at /data/kube9.db
  And the schema version is 1
  When the operator starts
  Then it should open the existing database connection
  And it should verify the schema version matches expected version
  And it should NOT recreate tables
  And it should be ready to accept event writes

Scenario: Store event in database
  Given the operator is running
  And the database is initialized
  When an event is stored with:
    | Field           | Value                          |
    | id              | evt_20251202_103045_a7f3b9     |
    | event_type      | operator                       |
    | severity        | info                           |
    | title           | Operator started               |
    | description     | Operator v1.0.0 started in free tier |
    | object_kind     | null                           |
    | object_namespace| null                           |
    | object_name     | null                           |
    | metadata        | {"version":"1.0.0"}            |
    | created_at      | 2025-12-02T10:30:45.000Z       |
  Then the event should be inserted into the events table
  And the event should be immediately queryable
  And the operation should complete in < 1ms

Scenario: Store event with object reference
  Given the operator is running
  When an event is stored referencing a Deployment
    | Field           | Value                          |
    | id              | evt_20251202_103050_b8g4c0     |
    | event_type      | insight                        |
    | severity        | warning                        |
    | title           | Deployment missing resource limits |
    | object_kind     | Deployment                     |
    | object_namespace| default                        |
    | object_name     | nginx                          |
  Then the event should be stored with object references
  And the object indexes should allow fast filtering by kind/namespace/name

Scenario: Store event with JSON metadata
  Given the operator is running
  When an event is stored with complex metadata:
    """json
    {
      "assessment_id": "waf_security_2025",
      "pillar": "security",
      "score": 45,
      "findings": 12
    }
    """
  Then the metadata should be stored as JSON text
  And the metadata should be parseable when queried
  And the metadata should support nested objects and arrays

Scenario: Prevent duplicate event IDs
  Given an event with ID "evt_20251202_103045_a7f3b9" exists
  When attempting to store another event with the same ID
  Then the database should reject the insertion with PRIMARY KEY constraint error
  And the operator should log the error
  And the operator should continue operating normally

Scenario: Query events by type
  Given 100 events exist in the database
  And 40 are operator events
  And 30 are insight events
  And 30 are assessment events
  When querying events filtered by event_type = 'operator'
  Then it should return exactly 40 events
  And the query should use the idx_events_type index
  And the query should complete in < 10ms

Scenario: Query events by severity
  Given 100 events exist in the database
  And 10 are critical severity
  When querying events filtered by severity = 'critical'
  Then it should return exactly 10 events
  And the query should use the idx_events_severity index

Scenario: Query events by date range
  Given events exist spanning December 1-15, 2025
  When querying events with created_at >= '2025-12-05' AND created_at < '2025-12-10'
  Then it should return only events from Dec 5-9
  And the query should use the idx_events_created index
  And events should be ordered by created_at DESC (newest first)

Scenario: Query events by object reference
  Given 50 events reference Deployment/default/nginx
  When querying events filtered by object_kind='Deployment', object_namespace='default', object_name='nginx'
  Then it should return exactly 50 events
  And the query should use the idx_events_object composite index

Scenario: Automatic retention cleanup for info events
  Given the retention policy is 7 days for info/warning events
  And an info event was created 8 days ago with ID evt_20251124_100000_old123
  When the retention cleanup job runs
  Then it should delete events where severity IN ('info', 'warning') AND created_at < 7 days ago
  And the old event should be deleted from the database
  And the deletion should be logged with count of deleted events

Scenario: Retain critical events for 30 days
  Given the retention policy is 30 days for error/critical events
  And a critical event was created 25 days ago
  When the retention cleanup job runs
  Then the critical event should NOT be deleted
  And it should be retained until 30 days have passed

Scenario: Retention cleanup runs on schedule
  Given the operator is running
  When the scheduled cleanup job triggers (every 6 hours)
  Then it should execute the retention cleanup
  And it should log the number of events deleted
  And it should update Prometheus metrics for cleanup operations

Scenario: Database size monitoring
  Given events are being stored over time
  When the database grows
  Then the operator should expose /metrics endpoint with:
    | Metric                              | Description                    |
    | kube9_events_storage_size_bytes     | Current database file size     |
    | kube9_database_operations_total     | Counter of insert/select/delete ops |
  And these metrics should be scrapable by Prometheus

Scenario: Database health check
  Given the operator is running
  When the /healthz endpoint is queried
  Then it should verify database connectivity
  And it should verify write capability with test query
  And it should include database status in health response
  And unhealthy database should mark operator as degraded

Scenario: Handle database corruption gracefully
  Given the database file becomes corrupted
  When the operator attempts to open the database
  Then it should detect the corruption error
  And it should log a critical error with recovery instructions
  And it should expose unhealthy status via /healthz
  And it should NOT crash or restart repeatedly

Scenario: Database migrations for schema changes
  Given the database is at schema version 1
  And a new operator version requires schema version 2
  When the operator starts
  Then it should detect the version mismatch
  And it should execute migration from v1 to v2
  And it should update the schema_version table
  And it should log the migration completion
  And existing events should remain intact

Scenario: Concurrent reads during writes
  Given the database uses WAL mode
  When events are being written by the background worker
  And a CLI query is executed simultaneously
  Then both operations should succeed without blocking
  And the CLI should read committed data
  And there should be no database locking errors

Scenario: Database backup considerations
  Given the operator is running
  When a cluster administrator wants to backup events
  Then they should be able to copy /data/kube9.db file
  And the backup should be consistent due to WAL mode
  And the operator documentation should include backup procedures
```

## Integration Points

- **EventEmitter**: Receives events from async queue and writes to database
- **DatabaseManager**: Manages database connection, schema, and migrations
- **CLI Query Interface**: Reads events from database for display
- **Prometheus**: Exports database metrics for monitoring
- **Health Check**: Includes database health in operator status

## Performance Requirements

- Event insertion: < 1ms per event
- Event query (100 events): < 10ms
- Retention cleanup (1000 deletions): < 100ms
- Database size: ~1MB per 10,000 events

## Non-Goals

- Multi-cluster event aggregation (future: kube9-server feature)
- Real-time event streaming (future enhancement)
- Full-text search in event descriptions (future: SQLite FTS5)
- Event export to external systems (future enhancement)

