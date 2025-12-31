---
spec_id: event-metrics-spec
feature_id: [event-database-storage, event-emission]
---

# Event Metrics Specification

## Overview

The operator must expose Prometheus metrics that provide comprehensive observability into event collection activities. Metrics enable monitoring of event throughput, queue health, storage utilization, and error rates.

## Metrics Architecture

### Prometheus Integration

The operator uses `prom-client` library (already integrated) and exposes metrics via the `/metrics` HTTP endpoint on port 8080.

**Existing Infrastructure**:
- `src/collection/metrics.ts` - Existing metrics registry and utilities
- Health server exposes `/metrics` endpoint
- Metrics follow Prometheus naming conventions

**New Addition**:
- `src/events/metrics.ts` - Event-specific metrics

### Metrics Registry

Event metrics will use the same Prometheus registry as collection metrics to provide a unified `/metrics` endpoint.

## Event Metrics Definitions

### 1. Events Received Counter

**Metric Name**: `kube9_operator_events_received_total`

**Type**: Counter

**Labels**:
- `type`: Event type (e.g., "Warning", "Normal", "Error")

**Description**: Total number of Kubernetes events received by the watcher

**Usage**:
```typescript
eventsReceivedTotal.inc({ type: k8sEvent.type || 'Normal' });
```

**When to Increment**:
- When `KubernetesEventWatcher` receives an event from the watch API
- Before significance filtering (counts all events seen)

### 2. Events Stored Counter

**Metric Name**: `kube9_operator_events_stored_total`

**Type**: Counter

**Labels**:
- `event_type`: Normalized event type (e.g., "operator", "insight", "kubernetes")
- `severity`: Event severity (e.g., "info", "warning", "error", "critical")

**Description**: Total number of events successfully written to the database

**Usage**:
```typescript
eventsStoredTotal.inc({
  event_type: event.event_type,
  severity: event.severity
});
```

**When to Increment**:
- After successful database insertion in `EventQueueWorker`

### 3. Events Errors Counter

**Metric Name**: `kube9_operator_events_errors_total`

**Type**: Counter

**Labels**:
- `reason`: Error reason (e.g., "normalization_failed", "db_write_failed", "queue_full")

**Description**: Total number of errors encountered during event processing

**Usage**:
```typescript
eventsErrorsTotal.inc({ reason: 'db_write_failed' });
```

**When to Increment**:
- Normalization failures
- Database write failures
- Queue full conditions (dropped events)
- Connection errors

### 4. Events Queue Size Gauge

**Metric Name**: `kube9_operator_events_queue_size`

**Type**: Gauge

**Labels**: None

**Description**: Current number of events in the async processing queue

**Usage**:
```typescript
eventsQueueSize.set(recorder.getQueueSize());
```

**When to Update**:
- After enqueue operation
- After dequeue operation
- Periodically (every 10 seconds) for accuracy

### 5. Events Dropped Counter

**Metric Name**: `kube9_operator_events_dropped_total`

**Type**: Counter

**Labels**: None

**Description**: Total number of events dropped due to queue being full

**Usage**:
```typescript
eventsDroppedTotal.inc();
```

**When to Increment**:
- When queue is full and oldest event is dropped

### 6. Events Storage Size Gauge

**Metric Name**: `kube9_operator_events_storage_size_bytes`

**Type**: Gauge

**Labels**: None

**Description**: Current size of the event database file in bytes

**Usage**:
```typescript
eventsStorageSizeBytes.set(dbFileSize);
```

**When to Update**:
- Periodically (every 60 seconds)
- After retention cleanup
- Uses `fs.statSync()` to get `/data/kube9.db` file size

### 7. Event Listener Healthy Gauge

**Metric Name**: `kube9_operator_event_listener_healthy`

**Type**: Gauge

**Labels**: None

**Description**: Event listener health status (1 = healthy, 0 = unhealthy)

**Usage**:
```typescript
eventListenerHealthy.set(watcher.isHealthy() ? 1 : 0);
```

**When to Update**:
- When watch connection starts: set to 1
- When watch connection fails: set to 0
- Periodically (every 10 seconds)

## Implementation Details

### src/events/metrics.ts

New module that defines event metrics:

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Prometheus metrics registry (shared with collection metrics)
 */
import { register } from '../collection/metrics.js';

/**
 * Counter for events received from Kubernetes watch API
 */
export const eventsReceivedTotal = new Counter({
  name: 'kube9_operator_events_received_total',
  help: 'Total number of Kubernetes events received by the watcher',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Counter for events successfully stored in database
 */
export const eventsStoredTotal = new Counter({
  name: 'kube9_operator_events_stored_total',
  help: 'Total number of events successfully written to the database',
  labelNames: ['event_type', 'severity'],
  registers: [register],
});

/**
 * Counter for event processing errors
 */
export const eventsErrorsTotal = new Counter({
  name: 'kube9_operator_events_errors_total',
  help: 'Total number of errors encountered during event processing',
  labelNames: ['reason'],
  registers: [register],
});

/**
 * Gauge for current event queue size
 */
export const eventsQueueSize = new Gauge({
  name: 'kube9_operator_events_queue_size',
  help: 'Current number of events in the async processing queue',
  registers: [register],
});

/**
 * Counter for dropped events
 */
export const eventsDroppedTotal = new Counter({
  name: 'kube9_operator_events_dropped_total',
  help: 'Total number of events dropped due to queue being full',
  registers: [register],
});

/**
 * Gauge for database storage size
 */
export const eventsStorageSizeBytes = new Gauge({
  name: 'kube9_operator_events_storage_size_bytes',
  help: 'Current size of the event database file in bytes',
  registers: [register],
});

/**
 * Gauge for event listener health
 */
export const eventListenerHealthy = new Gauge({
  name: 'kube9_operator_event_listener_healthy',
  help: 'Event listener health status (1 = healthy, 0 = unhealthy)',
  registers: [register],
});
```

### Integration Points

**src/events/kubernetes-event-watcher.ts**:
- Import `eventsReceivedTotal`, `eventListenerHealthy`
- Increment counter when events are received
- Update health gauge on connection state changes

**src/events/event-recorder.ts**:
- Import `eventsQueueSize`, `eventsDroppedTotal`
- Update gauge on enqueue/dequeue
- Increment counter when events are dropped

**src/events/queue-worker.ts**:
- Import `eventsStoredTotal`, `eventsErrorsTotal`, `eventsStorageSizeBytes`
- Increment success/error counters
- Periodically update storage size gauge

**src/collection/metrics.ts**:
- No changes needed (registry already exported)
- Event metrics automatically included in `/metrics` endpoint

## Metric Queries

### Common PromQL Queries

**Event ingestion rate**:
```promql
rate(kube9_operator_events_received_total[5m])
```

**Event storage rate by severity**:
```promql
rate(kube9_operator_events_stored_total[5m])
sum by (severity) (rate(kube9_operator_events_stored_total[5m]))
```

**Event processing error rate**:
```promql
rate(kube9_operator_events_errors_total[5m])
sum by (reason) (rate(kube9_operator_events_errors_total[5m]))
```

**Current queue depth**:
```promql
kube9_operator_events_queue_size
```

**Events dropped (total)**:
```promql
kube9_operator_events_dropped_total
```

**Database size (MB)**:
```promql
kube9_operator_events_storage_size_bytes / 1024 / 1024
```

**Event listener health status**:
```promql
kube9_operator_event_listener_healthy
```

## Alerting Examples

### High Error Rate

```yaml
alert: HighEventProcessingErrorRate
expr: rate(kube9_operator_events_errors_total[5m]) > 0.1
for: 5m
annotations:
  summary: "High event processing error rate detected"
  description: "Event errors at {{ $value }} per second"
```

### Queue Backup

```yaml
alert: EventQueueBackup
expr: kube9_operator_events_queue_size > 500
for: 10m
annotations:
  summary: "Event queue is backing up"
  description: "Queue size is {{ $value }}, may indicate processing issues"
```

### Event Listener Down

```yaml
alert: EventListenerDown
expr: kube9_operator_event_listener_healthy == 0
for: 2m
annotations:
  summary: "Event listener is unhealthy"
  description: "The Kubernetes event watcher is not operational"
```

### High Drop Rate

```yaml
alert: HighEventDropRate
expr: rate(kube9_operator_events_dropped_total[5m]) > 1
for: 5m
annotations:
  summary: "Events are being dropped"
  description: "Dropping {{ $value }} events/sec - queue may be undersized"
```

## Grafana Dashboard

### Recommended Panels

1. **Event Throughput**: Line graph of `events_received_total` and `events_stored_total` rates
2. **Queue Health**: Gauge showing current `events_queue_size`
3. **Error Rate**: Line graph of `events_errors_total` rate by reason
4. **Storage Growth**: Line graph of `events_storage_size_bytes`
5. **Listener Status**: Status panel showing `event_listener_healthy`
6. **Drop Rate**: Line graph of `events_dropped_total` rate

## Testing Requirements

### Unit Tests

**tests/events/metrics.test.ts**:
- Test metrics are registered correctly
- Test counter increments
- Test gauge updates
- Test label values are applied correctly

### Integration Tests

- Deploy operator in test cluster
- Generate test events
- Query `/metrics` endpoint
- Verify metrics are exposed and updating
- Verify labels are correct

## Performance Considerations

### Metric Cardinality

Event metrics have controlled cardinality:
- `events_received_total`: ~5-10 event types (low)
- `events_stored_total`: ~3 event types × 4 severities = 12 combinations (low)
- `events_errors_total`: ~5-10 error reasons (low)
- Other metrics: No labels (cardinality = 1)

Total: ~30 unique time series - well within Prometheus limits.

### Update Frequency

- Counters: Updated on every event (negligible overhead)
- Queue size gauge: Updated every 10 seconds (low overhead)
- Storage size gauge: Updated every 60 seconds (stat syscall)
- Health gauge: Updated every 10 seconds (low overhead)

### Storage Size Calculation

To avoid excessive disk I/O:
- Check file size at most once per minute
- Use cached value for metric scrapes
- Skip check if file doesn't exist

```typescript
let cachedStorageSize = 0;
let lastStorageCheck = 0;

function updateStorageMetrics(): void {
  const now = Date.now();
  if (now - lastStorageCheck < 60000) return; // Skip if checked in last 60s
  
  try {
    const stats = fs.statSync('/data/kube9.db');
    cachedStorageSize = stats.size;
    eventsStorageSizeBytes.set(cachedStorageSize);
    lastStorageCheck = now;
  } catch (error) {
    // Database doesn't exist yet or error reading
    eventsStorageSizeBytes.set(0);
  }
}
```

## Compatibility

### Backward Compatibility

New metrics are additive - existing metrics remain unchanged. No breaking changes to the `/metrics` endpoint.

### Multi-Cluster Monitoring

When scraping multiple clusters:
- Use Prometheus external labels to distinguish clusters
- Metrics remain consistent across operator versions
- Label names and semantics follow Prometheus conventions

## Non-Goals

- Real-time event streaming metrics (beyond queue size)
- Per-namespace event breakdowns (too high cardinality)
- Historical metric aggregation (use Prometheus for time-series)
- Metric-based event filtering (use PromQL queries instead)

