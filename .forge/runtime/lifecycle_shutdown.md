# Lifecycle Shutdown

## Graceful Shutdown Sequence

The operator implements graceful shutdown handling for `SIGTERM` and `SIGINT` signals. Shutdown is coordinated through `src/shutdown/handler.ts` with a 5-second timeout to prevent hangs.

### Shutdown Process

1. **Prevent Multiple Shutdowns**
   - Sets `isShuttingDown` flag to prevent concurrent shutdown attempts
   - Logs warning if shutdown already in progress

2. **Set Shutdown Timeout**
   - 5-second timeout (`SHUTDOWN_TIMEOUT_MS = 5000`)
   - Forces exit with code 1 if shutdown doesn't complete in time
   - Prevents operator from hanging indefinitely

3. **Stop Event Watcher**
   - Stops `KubernetesEventWatcher` first
   - Prevents new events from being recorded
   - Closes Kubernetes watch connections

4. **Stop Event Queue Worker**
   - Stops `EventQueueWorker`
   - Flushes remaining events from queue to database
   - Ensures all pending events are persisted before shutdown

5. **Stop Collection Scheduler**
   - Stops `CollectionScheduler` if present
   - Clears all collection timers/intervals
   - Prevents new collection tasks from starting

6. **Stop ArgoCD Detection Manager**
   - Stops `ArgoCDDetectionManager` if present
   - Clears periodic detection interval
   - Prevents new detection checks

7. **Stop Status Writer**
   - Stops `StatusWriter`
   - Clears status update interval
   - Prevents further ConfigMap updates

8. **Stop Registration Manager**
   - Stops `RegistrationManager` if present (optional)
   - Clears registration timers

9. **Stop Health Server**
   - Stops HTTP health server
   - Closes Express server connection
   - Probes become unavailable

10. **Write Final Status**
    - Builds final status object with:
      - `health: "unhealthy"`
      - `error: "Shutting down"`
      - Current collection stats
      - Current ArgoCD status
      - Registration state (if available)
    - Writes final status to ConfigMap via `statusWriter.writeFinalStatus()`
    - Ensures status reflects shutdown state

11. **Clear Timeout and Exit**
    - Clears shutdown timeout
    - Logs "Graceful shutdown completed"
    - Exits with code 0 (success)

### Error Handling During Shutdown

- Errors during shutdown are logged but don't prevent exit
- Timeout ensures shutdown always completes
- Final exit code is 0 even if errors occur (ensures clean pod termination)

## Signal Handling

### SIGTERM
- Sent by Kubernetes when pod is terminated
- Triggers graceful shutdown sequence
- Standard signal for container termination

### SIGINT
- Sent by Ctrl+C in terminal
- Triggers graceful shutdown sequence
- Useful for local development/testing

Both signals are handled identically and call `gracefulShutdown()` with all component references.

## Background Tasks

### Status Update Loop
- **Interval**: Every `statusUpdateIntervalSeconds` (default: 60 seconds)
- **Component**: `StatusWriter`
- **Action**: Updates ConfigMap with current operator status
- **Stopped during shutdown**: Yes (clears interval)

### Collection Scheduler
- **Tasks**:
  - Cluster metadata: Every `clusterMetadataIntervalSeconds` (default: 86400s = 24h)
    - Minimum interval: 3600s (1h)
    - Random offset: 0-1 hour
  - Resource inventory: Every `resourceInventoryIntervalSeconds` (default: 21600s = 6h)
    - Minimum interval: 1800s (30m)
    - Random offset: 0-30 minutes
  - Resource configuration patterns: Every `resourceConfigurationPatternsIntervalSeconds` (default: 43200s = 12h)
    - Minimum interval: 3600s (1h)
    - Random offset: 0-1 hour
- **Component**: `CollectionScheduler`
- **Stopped during shutdown**: Yes (clears all timers)

### ArgoCD Detection
- **Interval**: Every `ARGOCD_DETECTION_INTERVAL` hours (default: 6 hours)
- **Component**: `ArgoCDDetectionManager`
- **Action**: Checks for ArgoCD installation changes
- **Stopped during shutdown**: Yes (clears interval)

### Event Watcher
- **Mode**: Continuous watch on Kubernetes Events API
- **Component**: `KubernetesEventWatcher`
- **Action**: Watches and filters Kubernetes events
- **Stopped during shutdown**: Yes (stops watch, closes connections)

### Event Queue Worker
- **Mode**: Continuous processing of event queue
- **Component**: `EventQueueWorker`
- **Action**: Processes queued events and writes to database
- **Stopped during shutdown**: Yes (flushes queue, then stops)

### Event Retention Cleanup
- **Schedule**: On-demand or scheduled (not a continuous background task)
- **Component**: Database retention cleanup
- **Action**: Removes events older than retention policy
- **Retention**:
  - Info/warning events: `eventRetentionInfoWarningDays` (default: 7 days)
  - Error/critical events: `eventRetentionErrorCriticalDays` (default: 30 days)

## Shutdown Logging

Shutdown process logs:
- `"Shutdown initiated, beginning graceful shutdown..."`
- `"Stopping health server..."`
- `"Health server stopped"`
- `"Graceful shutdown completed"`
- `"Error during graceful shutdown"` (if errors occur)
- `"Shutdown timeout reached, forcing exit"` (if timeout occurs)

## Kubernetes Integration

- Kubernetes sends `SIGTERM` to pod before termination
- Operator has 5 seconds to complete shutdown (timeout)
- Final status update ensures ConfigMap reflects shutdown state
- Pod exits cleanly with code 0 (or 1 on timeout)
- Kubernetes waits for graceful termination before force-killing
