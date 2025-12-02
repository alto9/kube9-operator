---
story_id: 013-create-event-recorder-service
session_id: event-database-and-cli-query-interface
feature_id: [event-recording]
spec_id: []
status: completed
---

# Story: Create EventRecorder Service with Async Queue

## Objective

Create the `EventRecorder` service that manages an async event queue for non-blocking event recording.

## Acceptance Criteria

- [ ] `EventRecorder` class created as singleton
- [ ] Maintains async queue with max capacity (1000 events)
- [ ] `recordEvent()` method adds to queue (non-blocking, < 1ms)
- [ ] Queue overflow protection (drops oldest events)
- [ ] Exposes queue size via getter
- [ ] Thread-safe queue operations

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/events/event-recorder.ts`

## Implementation Notes

### EventRecorder Class

```typescript
import { Event } from '../types/event.js';

export class EventRecorder {
  private static instance: EventRecorder | null = null;
  private queue: Event[] = [];
  private readonly maxQueueSize = 1000;
  private droppedEventsCount = 0;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): EventRecorder {
    if (!EventRecorder.instance) {
      EventRecorder.instance = new EventRecorder();
    }
    return EventRecorder.instance;
  }

  /**
   * Record an event by adding it to the async queue.
   * This method is non-blocking and returns immediately.
   */
  public recordEvent(event: Event): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Queue is full - drop oldest event
      this.queue.shift();
      this.droppedEventsCount++;
      console.warn('Event queue full, dropped oldest event');
    }
    
    this.queue.push(event);
  }

  /**
   * Dequeue a single event for processing.
   * Returns null if queue is empty.
   */
  public dequeueEvent(): Event | null {
    return this.queue.shift() || null;
  }

  /**
   * Get current queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get total dropped events count
   */
  public getDroppedEventsCount(): number {
    return this.droppedEventsCount;
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
```

## Estimated Time

< 20 minutes

## Dependencies

- Story 007 (Event types must exist)

