/**
 * Event metrics for Prometheus
 * 
 * Provides comprehensive observability for event collection, processing,
 * and storage operations.
 */

import { Counter, Gauge } from 'prom-client';
import { register } from '../collection/metrics.js';

/**
 * Counter for events received from Kubernetes watch API
 * 
 * Labels:
 * - type: K8s event type (e.g., "Warning", "Normal", "Error")
 */
export const eventsReceivedTotal = new Counter({
  name: 'kube9_operator_events_received_total',
  help: 'Total number of Kubernetes events received by the watcher',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Counter for events successfully stored in database
 * 
 * Labels:
 * - event_type: Normalized event type (e.g., "operator", "insight", "kubernetes")
 * - severity: Event severity (e.g., "info", "warning", "error", "critical")
 */
export const eventsStoredTotal = new Counter({
  name: 'kube9_operator_events_stored_total',
  help: 'Total number of events successfully written to the database',
  labelNames: ['event_type', 'severity'],
  registers: [register],
});

/**
 * Counter for event processing errors
 * 
 * Labels:
 * - reason: Error reason (e.g., "normalization_failed", "db_write_failed", "queue_full")
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
 * Value: 1 = healthy, 0 = unhealthy
 */
export const eventListenerHealthy = new Gauge({
  name: 'kube9_operator_event_listener_healthy',
  help: 'Event listener health status (1 = healthy, 0 = unhealthy)',
  registers: [register],
});

