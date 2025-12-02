---
story_id: 017-integrate-event-system-in-operator
session_id: event-database-and-cli-query-interface
feature_id: [event-recording]
spec_id: []
status: pending
---

# Story: Integrate Event System in Operator Lifecycle

## Objective

Integrate the complete event system into the operator's startup, runtime, and shutdown lifecycle.

## Acceptance Criteria

- [ ] Initialize database schema on operator startup
- [ ] Start EventQueueWorker during startup
- [ ] Start KubernetesEventWatcher during startup
- [ ] Start RetentionCleanup job during startup
- [ ] Record operator startup event
- [ ] Flush event queue on shutdown
- [ ] Stop all event services on shutdown
- [ ] Record operator shutdown event

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/operator.ts`

## Implementation Notes

### Update Operator Startup/Shutdown

```typescript
import { DatabaseManager } from './database/manager.js';
import { SchemaManager } from './database/schema.js';
import { EventQueueWorker } from './events/queue-worker.js';
import { KubernetesEventWatcher } from './events/kubernetes-event-watcher.js';
import { RetentionCleanup } from './database/retention-cleanup.js';
import { EventRecorder } from './events/event-recorder.js';
import { createOperatorEvent } from './events/event-normalizer.js';

let queueWorker: EventQueueWorker;
let eventWatcher: KubernetesEventWatcher;
let retentionCleanup: RetentionCleanup;

export async function startOperator() {
  console.log('Starting kube9-operator...');
  
  try {
    // Initialize database
    console.log('Initializing database...');
    const dbManager = DatabaseManager.getInstance();
    const schemaManager = new SchemaManager();
    schemaManager.initialize();
    
    // Start event queue worker
    console.log('Starting event queue worker...');
    queueWorker = new EventQueueWorker();
    queueWorker.start();
    
    // Start retention cleanup job
    console.log('Starting retention cleanup job...');
    retentionCleanup = new RetentionCleanup(7, 30);
    retentionCleanup.start();
    
    // Start Kubernetes Event watching
    console.log('Starting Kubernetes Event watcher...');
    eventWatcher = new KubernetesEventWatcher();
    await eventWatcher.start();
    
    // Record operator startup event
    const recorder = EventRecorder.getInstance();
    const startupEvent = createOperatorEvent(
      'Operator started',
      `kube9-operator ${process.env.VERSION || '0.0.1'} started successfully`,
      'info',
      {
        version: process.env.VERSION || '0.0.1',
        node_version: process.version,
      }
    );
    recorder.recordEvent(startupEvent);
    
    // Initialize existing operator components
    // ... (existing code for KubernetesClient, RegistrationManager, etc.)
    
    console.log('kube9-operator started successfully');
    
  } catch (error: any) {
    console.error('Failed to start operator:', error.message);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
export async function shutdownOperator() {
  console.log('Shutting down kube9-operator...');
  
  try {
    // Record shutdown event
    const recorder = EventRecorder.getInstance();
    const shutdownEvent = createOperatorEvent(
      'Operator shutting down',
      'kube9-operator is shutting down',
      'info'
    );
    recorder.recordEvent(shutdownEvent);
    
    // Stop watching new events
    if (eventWatcher) {
      eventWatcher.stop();
    }
    
    // Stop retention cleanup
    if (retentionCleanup) {
      retentionCleanup.stop();
    }
    
    // Flush remaining events in queue (wait up to 5 seconds)
    if (queueWorker) {
      await queueWorker.flush(5000);
      queueWorker.stop();
    }
    
    // Close database
    const dbManager = DatabaseManager.getInstance();
    dbManager.close();
    
    console.log('kube9-operator shut down successfully');
    
  } catch (error: any) {
    console.error('Error during shutdown:', error.message);
  }
}

// Handle shutdown signals
process.on('SIGTERM', async () => {
  await shutdownOperator();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownOperator();
  process.exit(0);
});
```

## Estimated Time

< 25 minutes

## Dependencies

- Stories 004-016 (all event system components must be implemented)

