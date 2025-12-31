---
feature_group: event-system
---

# Event System Features

## Background

```gherkin
Background:
  Given the kube9 operator runs in Node.js 22
  And the operator needs to track historical activities
  And the operator has a PersistentVolume mounted at /data (enabled by default via Helm)
  And the operator stores events in SQLite database at /data/kube9.db
  And the operator exposes a CLI for querying events
  And the VS Code extension can query events via kubectl exec
  And the operator publishes Prometheus metrics for event observability
  And the operator health checks validate event listener capability
```

## Rules

```gherkin
Rule: Event recording must not impact operator performance
  Example: Event recording is non-blocking
    Given the operator is watching Kubernetes Events
    When a Kubernetes Event is detected and recorded
    Then the event should be normalized and added to an async queue
    And the operator should continue watching without waiting
    And the queue should be processed by a background worker

Rule: Events are free tier functionality
  Example: Events work without API key
    Given the operator is installed without an API key
    When events are emitted
    Then they should be stored in the local SQLite database
    And they should NOT be sent to kube9-server
    And they should be queryable via CLI

Rule: Events must be queryable with rich filtering
  Example: Query events by type and severity
    Given multiple events exist in the database
    When the CLI is used to query events
    Then it should support filtering by event type
    And it should support filtering by severity
    And it should support filtering by date range
    And it should support filtering by affected objects

Rule: Old events must be automatically cleaned up
  Example: Info events are deleted after 7 days
    Given an info-level event was created 8 days ago
    When the retention cleanup job runs
    Then the event should be deleted from the database
  
  Example: Critical events are retained for 30 days
    Given a critical-level event was created 25 days ago
    When the retention cleanup job runs
    Then the event should be retained in the database

Rule: Event IDs must be sortable and human-readable
  Example: Timestamp-based event IDs
    Given an event is created on 2025-12-02 at 10:30:45
    When the event ID is generated
    Then it should have format evt_20251202_103045_<random>
    And it should sort chronologically by ID
    And the timestamp should be human-readable

Rule: CLI must support multiple output formats
  Example: Query events in different formats
    Given events exist in the database
    When the CLI is used to query events
    Then it should support --format=json output
    And it should support --format=yaml output
    And it should support --format=table output for human viewing

Rule: Extensions must use RBAC to query events
  Example: VS Code extension queries via kubectl exec
    Given the VS Code extension wants to query events
    When it executes the CLI via kubectl exec
    Then the user must have pods/exec permissions in kube9-system namespace
    And the query should run inside the operator pod
    And the results should be returned as JSON

Rule: PVC must be enabled by default for event persistence
  Example: Default Helm installation creates PVC
    Given a user installs kube9-operator with default Helm values
    When the installation completes
    Then a PersistentVolumeClaim should be created for event storage
    And the PVC should use the cluster's default StorageClass
    And the PVC size should default to 5Gi
    And the operator should store events in the PVC-backed database

Rule: Event retention policies must be configurable
  Example: Configure retention periods via Helm values
    Given a user wants custom retention policies
    When they set events.retention.infoWarning=3 in Helm values
    And they set events.retention.errorCritical=60 in Helm values
    Then info and warning events should be retained for 3 days
    And error and critical events should be retained for 60 days

Rule: Health checks must validate event listener capability
  Example: Readiness probe fails if event listener cannot start
    Given the operator is starting up
    When the Kubernetes event watcher fails to start
    Then the readiness probe should return unhealthy
    And the pod should not receive traffic
    
  Example: Liveness probe fails if event listener stalls
    Given the operator is running
    When the event listener stops processing events for 5 minutes
    Then the liveness probe should return unhealthy
    And Kubernetes should restart the pod

Rule: Event metrics must be exposed for observability
  Example: Prometheus can scrape event metrics
    Given the operator is running and processing events
    When Prometheus scrapes the /metrics endpoint
    Then it should include kube9_operator_events_received_total counter
    And it should include kube9_operator_events_stored_total counter
    And it should include kube9_operator_events_errors_total counter
    And it should include kube9_operator_events_queue_size gauge
    And it should include kube9_operator_events_dropped_total counter
    And it should include kube9_operator_events_storage_size_bytes gauge
    And it should include kube9_operator_event_listener_healthy gauge
```

## Event Sources and Types

The event system **records events from multiple sources**:

### Primary Sources (External Events)
1. **Kubernetes Events** (via Watch API): Pod failures, node issues, scheduling problems, container errors
2. **Cluster Resource Changes** (via Informers): Node additions/removals, namespace changes, deployment scaling
3. **Resource Status Changes**: HPA scaling, PVC binding failures, service endpoint changes

### Generated Events (Operator Analysis)
4. **Insight Events**: New insights from cluster analysis, acknowledgments, resolutions
5. **Assessment Events**: Framework assessments, pillar status changes, security findings

### Supplementary Events (Operator Internal)
6. **Operator Events**: Startup, shutdown, health transitions (provides context for gaps)
7. **System Events**: Database maintenance, watch connection issues, collection status

## Event Filtering

The operator **does NOT record all Kubernetes Events**. Only significant events are recorded:

**Recorded Event Reasons:**
- Pod failures: `CrashLoopBackOff`, `ImagePullBackOff`, `OOMKilled`, `BackOff`
- Node issues: `NodeNotReady`, `NodeMemoryPressure`, `NodeDiskPressure`
- Resource issues: `FailedCreate`, `FailedBinding`, `FailedScheduling`
- Scaling events: `SuccessfulRescale`, `ScalingReplicaSet`

**Filtered Out (Too Noisy):**
- Normal scheduler events (`Scheduled`, `Pulling`, `Pulled`)
- Routine status updates
- Informational-only events with no action needed

## Event Severity Levels

- **info**: Normal operations, informational events
- **warning**: Potential issues that don't require immediate action
- **error**: Errors that affect functionality but are recoverable
- **critical**: Critical issues requiring immediate attention

## Retention Policy

- **Info/Warning**: 7 days (configurable via Helm values)
- **Error/Critical**: 30 days (configurable via Helm values)

## CLI Commands

```bash
# Operator serve mode (default)
kube9-operator
kube9-operator serve

# Query operator status
kube9-operator query status

# List events with filtering
kube9-operator query events list --type=operator --severity=error --since=2025-12-01

# Get single event
kube9-operator query events get evt_20251202_103045_a7f3b9

# Output formats
kube9-operator query events list --format=json
kube9-operator query events list --format=yaml
kube9-operator query events list --format=table
```

## Architecture

**Event Sources**:
- Kubernetes Watch API for Event objects
- Kubernetes Informers for resource changes (Nodes, Deployments, etc.)
- Operator-generated insights and assessments

**Event Processing**:
- EventRecorder normalizes external events into internal format
- Async queue buffers events (non-blocking)
- Background worker writes to SQLite database

**Event Storage**: SQLite at `/data/kube9.db` with WAL mode

**Query Interface**: CLI accessed via kubectl exec from extensions (commander + zod)

## Integration Points

- **VS Code Extension**: Queries events via kubectl exec to display Event Viewer
- **Web UI (Future)**: Same CLI query interface for web-based event viewing
- **Prometheus**: Metrics for event emission rate, database size, query performance
- **Kubernetes RBAC**: Controls who can query events (pods/exec permission)

