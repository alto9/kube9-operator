# Messaging (Async)

## Event Queue (Internal)

### Architecture

**Non-Blocking Event Recording**: Event emission is non-blocking and returns immediately, preventing operator logic from blocking on event storage.

**Components**:
1. **EventRecorder** (`src/events/event-recorder.ts`): Singleton in-memory queue
2. **EventQueueWorker** (`src/events/queue-worker.ts`): Background processor
3. **EventRepository** (`src/database/event-repository.ts`): SQLite persistence layer

### EventRecorder

**Implementation**: Singleton pattern with in-memory queue

**Queue Properties**:
- **Max size**: 1000 events
- **Behavior**: When queue is full, oldest event is dropped (FIFO)
- **Metrics**: Tracks queue size and dropped event count

**Methods**:
- `recordEvent(event)`: Non-blocking enqueue operation
- `dequeueEvent()`: Dequeue single event for processing
- `isEmpty()`: Check if queue is empty
- `getQueueSize()`: Get current queue size
- `getDroppedEventsCount()`: Get total dropped events

**Event Dropping**:
- When queue reaches max size (1000), oldest event is dropped
- Dropped events counter incremented
- Warning logged when drop occurs

### EventQueueWorker

**Implementation**: Background worker that processes queue periodically

**Processing Behavior**:
- **Interval**: Processes queue every 100ms (`processIntervalMs`)
- **Batch size**: Processes up to 10 events per cycle (`maxBatchSize`)
- **Non-blocking**: Processing runs in background, doesn't block operator loop

**Lifecycle**:
- **Start**: Called during operator startup (`startOperator()`)
- **Stop**: Called during graceful shutdown with flush timeout
- **Flush**: On shutdown, attempts to flush remaining events with 5-second timeout

**Storage Metrics**:
- **Update interval**: Checks storage size every 60 seconds (`storageCheckIntervalMs`)
- **Metric**: `eventsStorageSizeBytes` - Tracks SQLite database file size
- **Path**: `/data/kube9.db` (configurable via `DB_PATH`)

**Error Handling**:
- Database write failures increment error counter (`eventsErrorsTotal`)
- Errors logged but don't stop queue processing
- Failed events are lost (no retry mechanism)

**Metrics Exported**:
- `eventsStoredTotal`: Counter of successfully stored events (by event_type and severity)
- `eventsErrorsTotal`: Counter of storage errors (by reason)
- `eventsStorageSizeBytes`: Gauge of database file size in bytes
- `eventsQueueSize`: Gauge of current queue size
- `eventsDroppedTotal`: Counter of dropped events

### Queue Management

**Startup Sequence**:
1. Database schema initialized
2. EventQueueWorker started (begins processing queue)
3. EventRecorder singleton available for event recording
4. KubernetesEventWatcher started (feeds events to queue)

**Shutdown Sequence**:
1. EventQueueWorker.stop() called
2. Processing interval cleared
3. Flush remaining events (5-second timeout)
4. Storage metrics interval cleared
5. Log shutdown completion

**Flush Behavior**:
- Attempts to process all remaining events
- Processes in batches of up to 10 events
- 10ms delay between batches
- Times out after 5 seconds
- Warns if events remain after timeout

### Event Flow

**Recording**:
1. Operator code calls `EventRecorder.getInstance().recordEvent(event)`
2. Event added to in-memory queue (non-blocking)
3. Returns immediately

**Processing**:
1. EventQueueWorker processes queue every 100ms
2. Dequeues up to 10 events per cycle
3. Inserts each event into SQLite via EventRepository
4. Updates metrics on success/failure

**Persistence**:
- Events stored in `events` table in SQLite database
- Schema: `id`, `event_type`, `severity`, `title`, `description`, `object_kind`, `object_namespace`, `object_name`, `metadata`, `created_at`
- Event ID format: `evt_YYYYMMDD_HHMMSS_<random>`

### Benefits

**Performance**:
- Operator logic never blocks on database writes
- High-throughput event recording
- Background processing doesn't impact operator responsiveness

**Reliability**:
- Queue buffers events during database slowdowns
- Graceful degradation (drops oldest events if queue full)
- Metrics provide visibility into queue health

**Observability**:
- Queue size metrics for monitoring
- Error counters for alerting
- Storage size tracking for capacity planning
