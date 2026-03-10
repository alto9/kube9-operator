# Observability

## Prometheus Metrics
- `/metrics` endpoint
- Event metrics: events_received_total, events_stored_total, events_errors_total, queue_size, etc.
- Operator health, collection status

## Health Checks
- Liveness: operator process responsive
- Readiness: event listener started, database available
- Event listener stall (5 min) → liveness fails

## Logging
- Winston; configurable level (debug, info, warn, error)
- Structured logging for troubleshooting
