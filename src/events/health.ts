/**
 * Event system health tracking
 * 
 * Provides health status for the event listener and queue processing.
 * Used by the operator's health check endpoints.
 */

import { EventRecorder } from './event-recorder.js';
import { logger } from '../logging/logger.js';

/**
 * Event listener health details
 */
export interface EventListenerHealth {
  healthy: boolean;
  message: string;
  details: {
    isWatching: boolean;
    lastEventTime: number | null;
    queueSize: number;
    droppedEvents: number;
  };
}

// Module-level state
let eventWatcherInstance: { isHealthy: () => boolean; getLastEventTime: () => number | null } | null = null;

/**
 * Register the event watcher instance for health checks
 */
export function registerEventWatcher(watcher: { isHealthy: () => boolean; getLastEventTime: () => number | null }): void {
  eventWatcherInstance = watcher;
}

/**
 * Get current health status of the event listener
 * 
 * @returns Health status with details
 */
export function getEventListenerHealth(): EventListenerHealth {
  const recorder = EventRecorder.getInstance();
  
  // If watcher not registered yet, operator is still initializing
  if (!eventWatcherInstance) {
    return {
      healthy: false,
      message: 'Event watcher not initialized',
      details: {
        isWatching: false,
        lastEventTime: null,
        queueSize: recorder.getQueueSize(),
        droppedEvents: recorder.getDroppedEventsCount(),
      },
    };
  }
  
  const isHealthy = eventWatcherInstance.isHealthy();
  const lastEventTime = eventWatcherInstance.getLastEventTime();
  
  if (!isHealthy) {
    return {
      healthy: false,
      message: 'Event listener is not watching',
      details: {
        isWatching: false,
        lastEventTime,
        queueSize: recorder.getQueueSize(),
        droppedEvents: recorder.getDroppedEventsCount(),
      },
    };
  }
  
  return {
    healthy: true,
    message: 'Event listener is healthy',
    details: {
      isWatching: true,
      lastEventTime,
      queueSize: recorder.getQueueSize(),
      droppedEvents: recorder.getDroppedEventsCount(),
    },
  };
}

