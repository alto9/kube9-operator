---
spec_id: event-health-check-spec
feature_id: [event-database-storage, event-emission]
---

# Event Health Check Specification

## Overview

The operator must expose health check endpoints that validate the event listener's ability to capture and process Kubernetes events. Health checks ensure the event system is operational and trigger pod restarts if the system becomes unhealthy.

## Health Check Architecture

### Readiness Probe

**Purpose**: Determines if the operator is ready to serve traffic and perform its primary functions.

**Endpoint**: `GET /readyz`

**Checks**:
1. Operator initialization complete
2. ConfigMap write capability verified
3. Event listener started and active
4. Event queue is accepting events

**Failure Behavior**:
- Pod removed from service endpoints
- Traffic no longer routed to pod
- Pod continues running (not restarted)
- Allows temporary issues to self-heal

### Liveness Probe

**Purpose**: Determines if the operator process is alive and making progress.

**Endpoint**: `GET /healthz`

**Checks**:
1. Kubernetes API client accessible
2. Event listener connection is active
3. Event processing is not stalled (events processed in last 5 minutes OR no events available)

**Failure Behavior**:
- Pod marked as unhealthy after failureThreshold attempts
- Kubernetes restarts the container
- Fresh start resolves stuck states

## Event Listener Health Tracking

### Health State

The `KubernetesEventWatcher` must track:

```typescript
interface EventListenerHealth {
  isWatching: boolean;           // Watch connection is active
  lastEventTime: number | null;  // Timestamp of last event processed
  connectionErrors: number;       // Count of connection errors
  isHealthy: boolean;             // Overall health status
}
```

### Health Determination

**Listener is Healthy when**:
- `isWatching === true` (watch connection active)
- No fatal connection errors
- Either:
  - Events have been processed in the last 5 minutes, OR
  - No events have been available (cluster is quiet)

**Listener is Unhealthy when**:
- `isWatching === false` (watch connection not established)
- Fatal connection error occurred
- Event processing appears stalled

### Stall Detection

To avoid false positives in quiet clusters, stall detection requires:
1. Event listener is watching (`isWatching === true`)
2. No events processed in last 5 minutes
3. Queue has been empty for entire duration (no backlog)

This ensures we only flag stalls when the listener should be processing but isn't, not when the cluster simply has no events.

## Implementation Details

### src/events/health.ts

New module that provides event health status:

```typescript
/**
 * Get current health status of the event listener
 */
export function getEventListenerHealth(): {
  healthy: boolean;
  message: string;
  details: {
    isWatching: boolean;
    lastEventTime: number | null;
    queueSize: number;
    droppedEvents: number;
  };
}
```

### src/events/kubernetes-event-watcher.ts

Add health tracking methods:

```typescript
class KubernetesEventWatcher {
  private lastEventTime: number | null = null;
  
  /**
   * Check if the watcher is healthy
   */
  public isHealthy(): boolean {
    // Healthy if watching and no stall detected
    return this.isWatching && !this.isStalled();
  }
  
  /**
   * Get the timestamp of the last processed event
   */
  public getLastEventTime(): number | null {
    return this.lastEventTime;
  }
  
  /**
   * Check if event processing appears stalled
   */
  private isStalled(): boolean {
    if (!this.lastEventTime) return false;
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.lastEventTime < fiveMinutesAgo;
  }
}
```

### src/health/checks.ts

Update health checks to include event listener:

```typescript
export async function checkReadiness(): Promise<HealthCheckResult> {
  // Existing checks (initialization, ConfigMap write)
  if (!getInitialized()) {
    return { healthy: false, message: 'Not ready: Operator not initialized' };
  }
  
  const canWrite = await testConfigMapWrite(kubernetesClient.coreApi);
  if (!canWrite) {
    return { healthy: false, message: 'Not ready: Cannot write ConfigMap' };
  }
  
  // NEW: Check event listener health
  const eventHealth = getEventListenerHealth();
  if (!eventHealth.healthy) {
    return {
      healthy: false,
      message: `Not ready: Event listener unhealthy - ${eventHealth.message}`
    };
  }
  
  return { healthy: true, message: 'Ready' };
}

export async function checkLiveness(): Promise<HealthCheckResult> {
  // Existing check (API client accessible)
  await kubernetesClient.getClusterInfo();
  
  // NEW: Check event listener is not stalled
  const eventHealth = getEventListenerHealth();
  if (!eventHealth.details.isWatching) {
    return {
      healthy: false,
      message: 'Not healthy: Event listener not watching'
    };
  }
  
  return { healthy: true, message: 'OK' };
}
```

## Helm Chart Configuration

The deployment's health probe configuration remains the same - the implementation changes are transparent to Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## Testing Requirements

### Unit Tests

**tests/events/health.test.ts**:
- Test `getEventListenerHealth()` returns healthy when watching
- Test `getEventListenerHealth()` returns unhealthy when not watching
- Test stall detection in quiet clusters (should not trigger)
- Test stall detection when actually stalled (should trigger)

**tests/health/checks.test.ts**:
- Test readiness probe includes event listener check
- Test liveness probe validates event listener is watching
- Test health checks handle event listener failures gracefully

### Integration Tests

- Deploy operator in test cluster
- Verify readiness probe passes when event listener starts
- Simulate event listener failure, verify readiness probe fails
- Verify liveness probe triggers restart after prolonged failure

## Observability

Health check status is exposed via:
1. HTTP endpoints (`/healthz`, `/readyz`)
2. Prometheus metric: `kube9_operator_event_listener_healthy` (0 or 1)
3. Operator logs with structured health status

## Edge Cases

### Quiet Clusters

In clusters with no events:
- Event listener is healthy (watching, no stalls)
- `lastEventTime` remains null or old
- Health checks must not fail

### Burst Events

During event bursts:
- Queue may grow temporarily
- Listener remains healthy as long as processing continues
- Dropped events increment counter but don't fail health

### Network Blips

Temporary network issues:
- Watch connection may reconnect automatically
- Short interruptions don't trigger health failures
- Persistent issues (>30s) trigger readiness failure

## Non-Goals

- Detailed diagnostics in health check response (use /metrics for observability)
- Historical health tracking (use Prometheus for time-series)
- Alerting logic (use Prometheus Alertmanager)

