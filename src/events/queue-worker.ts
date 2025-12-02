/**
 * Event Queue Worker - Background processor for event queue
 */

import { EventRecorder } from './event-recorder.js';
import { EventRepository } from '../database/event-repository.js';
import { logger } from '../logging/logger.js';

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
      logger.warn('Event queue worker already running');
      return;
    }
    
    this.isRunning = true;
    this.intervalHandle = setInterval(() => {
      this.processQueue();
    }, this.processIntervalMs);
    
    logger.info('Event queue worker started');
  }

  /**
   * Stop the background worker
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    // Flush remaining events
    await this.flush(5000);
    
    logger.info('Event queue worker stopped');
  }

  /**
   * Process events from the queue
   */
  private processQueue(): void {
    let processed = 0;
    const maxBatchSize = 10;
    
    while (processed < maxBatchSize && !this.recorder.isEmpty()) {
      const event = this.recorder.dequeueEvent();
      
      if (!event) {
        break;
      }
      
      try {
        this.repository.insertEvent(event);
        processed++;
      } catch (error: any) {
        logger.error('Failed to write event to database', {
          error: error.message,
          event_id: event.id,
        });
      }
    }
    
    if (processed > 0) {
      logger.debug(`Processed ${processed} events from queue`);
    }
  }

  /**
   * Flush remaining events from queue
   */
  private async flush(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (!this.recorder.isEmpty() && (Date.now() - startTime) < timeoutMs) {
      this.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const remaining = this.recorder.getQueueSize();
    if (remaining > 0) {
      logger.warn(`Event queue flush timeout: ${remaining} events remaining`);
    }
  }
}

