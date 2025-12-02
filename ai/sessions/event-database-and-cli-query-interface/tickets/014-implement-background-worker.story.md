---
story_id: 014-implement-background-worker
session_id: event-database-and-cli-query-interface
feature_id: [event-recording]
spec_id: []
status: pending
---

# Story: Implement Background Worker for Event Queue Processing

## Objective

Create a background worker that continuously processes the event queue and writes events to the database.

## Acceptance Criteria

- [ ] `EventQueueWorker` class created
- [ ] Runs continuously in background (setInterval)
- [ ] Dequeues events and writes to database
- [ ] Handles database write failures with retry logic
- [ ] Exponential backoff for retries (max 3 attempts)
- [ ] Can be started and stopped gracefully
- [ ] Flushes queue on shutdown (max 5 seconds)

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/events/queue-worker.ts`

## Implementation Notes

### EventQueueWorker Class

```typescript
import { EventRecorder } from './event-recorder.js';
import { EventRepository } from '../database/event-repository.js';

export class EventQueueWorker {
  private recorder: EventRecorder;
  private repository: EventRepository;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  private processIntervalMs = 100; // Process every 100ms

  constructor() {
    this.recorder = EventRecorder.getInstance();
    this.repository = new EventRepository();
  }

  /**
   * Start the background worker
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('Event queue worker already running');
      return;
    }
    
    this.isRunning = true;
    this.intervalHandle = setInterval(() => {
      this.processQueue();
    }, this.processIntervalMs);
    
    console.log('Event queue worker started');
  }

  /**
   * Stop the background worker
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    console.log('Event queue worker stopped');
  }

  /**
   * Flush remaining events in queue (for shutdown)
   */
  public async flush(timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    console.log('Flushing event queue...');
    
    while (!this.recorder.isEmpty()) {
      if (Date.now() - startTime > timeoutMs) {
        const remaining = this.recorder.getQueueSize();
        console.warn(`Queue flush timeout: ${remaining} events remaining`);
        break;
      }
      
      this.processQueue();
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('Event queue flushed');
  }

  /**
   * Process events from the queue
   */
  private processQueue(): void {
    // Process up to 10 events per iteration
    const batchSize = 10;
    
    for (let i = 0; i < batchSize; i++) {
      const event = this.recorder.dequeueEvent();
      
      if (!event) {
        // Queue is empty
        break;
      }
      
      this.processEvent(event);
    }
  }

  /**
   * Process a single event with retry logic
   */
  private processEvent(event: any, attempt: number = 1): void {
    const maxAttempts = 3;
    
    try {
      const success = this.repository.insertEvent(event);
      
      if (!success && attempt < maxAttempts) {
        // Retry with exponential backoff
        const delayMs = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
        setTimeout(() => {
          this.processEvent(event, attempt + 1);
        }, delayMs);
      }
    } catch (error: any) {
      console.error(`Failed to insert event (attempt ${attempt}/${maxAttempts}):`, error.message);
      
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt) * 100;
        setTimeout(() => {
          this.processEvent(event, attempt + 1);
        }, delayMs);
      } else {
        console.error(`Permanently failed to insert event ${event.id}`);
      }
    }
  }
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 007 (EventRepository)
- Story 013 (EventRecorder)

