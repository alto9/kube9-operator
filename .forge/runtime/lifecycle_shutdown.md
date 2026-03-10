# Lifecycle Shutdown

## Graceful Shutdown
- Handle SIGTERM

- Drain event queue before exit
- Close database connections
- Stop status update loop
- Stop collection scheduler
- Stop Kubernetes watchers

## Background Tasks
- Status update: every 60s
- Collection: 24h, 6h, 12h intervals with random offset
- Event retention cleanup: on schedule
