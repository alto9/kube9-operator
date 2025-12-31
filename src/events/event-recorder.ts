/**
 * Event Recorder - Async event queue singleton
 */

import { Event } from '../types/event.js';
import { eventsQueueSize, eventsDroppedTotal } from './metrics.js';
import { logger } from '../logging/logger.js';

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
      eventsDroppedTotal.inc();
      logger.warn('Event queue full, dropped oldest event');
    }
    
    this.queue.push(event);
    eventsQueueSize.set(this.queue.length);
  }

  /**
   * Dequeue a single event for processing.
   * Returns null if queue is empty.
   */
  public dequeueEvent(): Event | null {
    const event = this.queue.shift() || null;
    eventsQueueSize.set(this.queue.length);
    return event;
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
  
  /**
   * Reset singleton (for testing)
   */
  public static reset(): void {
    EventRecorder.instance = null;
  }
}

