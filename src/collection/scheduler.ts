import { createHash } from 'crypto';
import { logger } from '../logging/logger.js';

/**
 * Task configuration for a collection type
 */
interface CollectionTask {
  /**
   * Collection type identifier (e.g., "cluster-metadata", "resource-inventory")
   */
  type: string;

  /**
   * Collection interval in seconds (enforced minimum)
   */
  intervalSeconds: number;

  /**
   * Minimum allowed interval in seconds
   */
  minIntervalSeconds: number;

  /**
   * Random offset range in seconds (0 to this value)
   */
  offsetRangeSeconds: number;

  /**
   * Collection callback function
   */
  callback: () => Promise<void>;

  /**
   * Initial offset timeout handle
   */
  offsetTimeout: NodeJS.Timeout | null;

  /**
   * Periodic interval timer handle
   */
  intervalTimer: NodeJS.Timeout | null;
}

/**
 * CollectionScheduler manages periodic data collection tasks with configurable
 * intervals, random offsets, and graceful shutdown support.
 */
export class CollectionScheduler {
  private readonly tasks: Map<string, CollectionTask> = new Map();
  private isStarted: boolean = false;

  /**
   * Registers a collection task with the scheduler
   * 
   * @param type - Collection type identifier
   * @param intervalSeconds - Collection interval in seconds
   * @param minIntervalSeconds - Minimum allowed interval in seconds
   * @param offsetRangeSeconds - Random offset range in seconds (0 to this value)
   * @param callback - Collection callback function
   */
  register(
    type: string,
    intervalSeconds: number,
    minIntervalSeconds: number,
    offsetRangeSeconds: number,
    callback: () => Promise<void>
  ): void {
    // Enforce minimum interval
    let effectiveInterval = intervalSeconds;
    if (intervalSeconds < minIntervalSeconds) {
      logger.warn(
        `Collection interval ${intervalSeconds}s for type "${type}" is below minimum ${minIntervalSeconds}s, using minimum`,
        { type, intervalSeconds, minIntervalSeconds }
      );
      effectiveInterval = minIntervalSeconds;
    }

    // Generate consistent random offset per collection type
    const offsetSeconds = this.generateOffset(type, offsetRangeSeconds);

    // Store task configuration
    const task: CollectionTask = {
      type,
      intervalSeconds: effectiveInterval,
      minIntervalSeconds,
      offsetRangeSeconds,
      callback,
      offsetTimeout: null,
      intervalTimer: null,
    };

    this.tasks.set(type, task);

    logger.info('Collection task registered', {
      type,
      intervalSeconds: effectiveInterval,
      minIntervalSeconds,
      offsetRangeSeconds,
      offsetSeconds,
    });
  }

  /**
   * Starts the scheduler and begins scheduling collections
   */
  start(): void {
    if (this.isStarted) {
      logger.warn('Collection scheduler is already started');
      return;
    }

    if (this.tasks.size === 0) {
      logger.warn('No collection tasks registered, scheduler not started');
      return;
    }

    this.isStarted = true;
    logger.info('Starting collection scheduler', { taskCount: this.tasks.size });

    // Schedule each registered task
    for (const task of this.tasks.values()) {
      this.scheduleTask(task);
    }
  }

  /**
   * Stops the scheduler and clears all scheduled collections
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    logger.info('Stopping collection scheduler', { taskCount: this.tasks.size });

    // Clear all timers
    for (const task of this.tasks.values()) {
      if (task.offsetTimeout !== null) {
        clearTimeout(task.offsetTimeout);
        task.offsetTimeout = null;
      }
      if (task.intervalTimer !== null) {
        clearInterval(task.intervalTimer);
        task.intervalTimer = null;
      }
    }

    this.isStarted = false;
    logger.info('Collection scheduler stopped');
  }

  /**
   * Generates a consistent random offset for a collection type
   * Uses hash-based approach to ensure same type gets same offset per instance
   * 
   * @param type - Collection type identifier
   * @param offsetRangeSeconds - Maximum offset in seconds
   * @returns Offset in seconds (0 to offsetRangeSeconds)
   */
  private generateOffset(type: string, offsetRangeSeconds: number): number {
    const hash = createHash('sha256').update(type).digest('hex');
    // Convert first 8 hex characters to number (0 to 2^32-1)
    const hashValue = parseInt(hash.substring(0, 8), 16);
    // Modulo to get value in range [0, offsetRangeSeconds)
    return hashValue % offsetRangeSeconds;
  }

  /**
   * Schedules a collection task with initial offset delay, then periodic intervals
   * 
   * @param task - Collection task to schedule
   */
  private scheduleTask(task: CollectionTask): void {
    const offsetMs = this.generateOffset(task.type, task.offsetRangeSeconds) * 1000;
    const intervalMs = task.intervalSeconds * 1000;

    logger.info('Scheduling collection task', {
      type: task.type,
      offsetSeconds: offsetMs / 1000,
      intervalSeconds: task.intervalSeconds,
    });

    // Schedule initial collection after offset delay
    task.offsetTimeout = setTimeout(() => {
      // Execute initial collection
      this.executeCollection(task).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Collection task execution failed', {
          type: task.type,
          error: errorMessage,
        });
      });

      // After first collection, schedule periodic collections
      task.intervalTimer = setInterval(() => {
        this.executeCollection(task).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Collection task execution failed', {
            type: task.type,
            error: errorMessage,
          });
        });
      }, intervalMs);
    }, offsetMs);
  }

  /**
   * Executes a collection task callback
   * 
   * @param task - Collection task to execute
   */
  private async executeCollection(task: CollectionTask): Promise<void> {
    logger.debug('Executing collection task', { type: task.type });
    await task.callback();
  }
}

