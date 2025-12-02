---
story_id: 018-add-prometheus-metrics-for-events
session_id: event-database-and-cli-query-interface
feature_id: [event-recording, event-database-storage]
spec_id: []
status: pending
---

# Story: Add Prometheus Metrics for Event System

## Objective

Add Prometheus metrics to track event recording, queue status, and database operations.

## Acceptance Criteria

- [ ] `kube9_events_total` counter (by type, severity)
- [ ] `kube9_events_queue_size` gauge
- [ ] `kube9_events_dropped_total` counter
- [ ] `kube9_events_storage_size_bytes` gauge
- [ ] `kube9_database_operations_total` counter (by operation type)
- [ ] Metrics exposed on `/metrics` endpoint
- [ ] Metrics update in real-time

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/events/event-recorder.ts`
- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/event-repository.ts`
- `/home/danderson/code/alto9/opensource/kube9-operator/src/metrics/index.ts` (if exists, or create)

## Implementation Notes

### Prometheus Metrics Setup

```typescript
// src/metrics/event-metrics.ts
import * as client from 'prom-client';

// Counter for total events recorded
export const eventsTotal = new client.Counter({
  name: 'kube9_events_total',
  help: 'Total number of events recorded',
  labelNames: ['event_type', 'severity'],
});

// Gauge for current queue size
export const eventsQueueSize = new client.Gauge({
  name: 'kube9_events_queue_size',
  help: 'Current number of events in queue',
});

// Counter for dropped events
export const eventsDroppedTotal = new client.Counter({
  name: 'kube9_events_dropped_total',
  help: 'Total number of events dropped due to queue overflow',
});

// Gauge for database size
export const eventsStorageSizeBytes = new client.Gauge({
  name: 'kube9_events_storage_size_bytes',
  help: 'Size of events database in bytes',
});

// Counter for database operations
export const databaseOperationsTotal = new client.Counter({
  name: 'kube9_database_operations_total',
  help: 'Total database operations',
  labelNames: ['operation'], // insert, select, delete
});
```

### Update EventRecorder

```typescript
import { eventsTotal, eventsQueueSize, eventsDroppedTotal } from '../metrics/event-metrics.js';

export class EventRecorder {
  // ... existing code ...

  public recordEvent(event: Event): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      this.droppedEventsCount++;
      eventsDroppedTotal.inc();
      console.warn('Event queue full, dropped oldest event');
    }
    
    this.queue.push(event);
    
    // Update metrics
    eventsTotal.inc({ event_type: event.event_type, severity: event.severity });
    eventsQueueSize.set(this.queue.length);
  }

  public dequeueEvent(): Event | null {
    const event = this.queue.shift() || null;
    
    // Update queue size metric
    eventsQueueSize.set(this.queue.length);
    
    return event;
  }
}
```

### Update EventRepository

```typescript
import { databaseOperationsTotal } from '../metrics/event-metrics.js';

export class EventRepository {
  // ... existing code ...

  public insertEvent(event: Event): boolean {
    try {
      // ... existing insert code ...
      
      // Update metrics
      databaseOperationsTotal.inc({ operation: 'insert' });
      
      return true;
    } catch (error: any) {
      // ... existing error handling ...
    }
  }

  public queryEvents(options: EventQueryOptions = {}): Event[] {
    // ... existing query code ...
    
    // Update metrics
    databaseOperationsTotal.inc({ operation: 'select' });
    
    return rows.map(row => this.deserializeEvent(row));
  }
}
```

### Periodic Database Size Monitoring

```typescript
// In operator startup, schedule periodic size check
setInterval(() => {
  const dbManager = DatabaseManager.getInstance();
  const dbPath = dbManager.getDbPath();
  
  try {
    const stats = fs.statSync(dbPath);
    eventsStorageSizeBytes.set(stats.size);
  } catch (error) {
    // Database file may not exist yet
  }
}, 60000); // Every minute
```

## Estimated Time

< 25 minutes

## Dependencies

- Story 013 (EventRecorder)
- Story 007 (EventRepository)
- Existing Prometheus metrics infrastructure

