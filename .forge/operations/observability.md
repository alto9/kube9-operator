# Observability

## Health Endpoints

The operator exposes three HTTP endpoints on port 8080 for health monitoring:

### Liveness Probe (`/healthz`)
- **Purpose**: Indicates if the operator process is alive and responsive
- **HTTP Method**: GET
- **Success Status**: 200 OK
- **Failure Status**: 500 Internal Server Error
- **Check Logic**:
  1. Verifies Kubernetes API server connectivity via `getClusterInfo()`
  2. Verifies event listener is actively watching (not stalled)
  3. Timeout: 5 seconds
- **Failure Conditions**:
  - Cannot reach Kubernetes API server
  - Event listener is not watching
  - Health check timeout exceeded
- **Kubernetes Configuration**: 
  - Initial delay: 30 seconds
  - Period: 10 seconds
  - Path: `/healthz`
  - Port: 8080

### Readiness Probe (`/readyz`)
- **Purpose**: Indicates if the operator is ready to serve traffic
- **HTTP Method**: GET
- **Success Status**: 200 OK
- **Failure Status**: 503 Service Unavailable
- **Check Logic**:
  1. Verifies operator has completed initialization
  2. Tests ConfigMap write capability (validates RBAC permissions)
  3. Verifies event listener is operational
  4. Timeout: 5 seconds
- **Failure Conditions**:
  - Operator not initialized
  - Cannot write ConfigMaps (RBAC/permission issue)
  - Event listener unhealthy
  - Readiness check timeout exceeded
- **Kubernetes Configuration**:
  - Initial delay: 10 seconds
  - Period: 5 seconds
  - Path: `/readyz`
  - Port: 8080

### Metrics Endpoint (`/metrics`)
- **Purpose**: Prometheus-formatted metrics for monitoring
- **HTTP Method**: GET
- **Content-Type**: `text/plain; version=0.0.4; charset=utf-8`
- **Success Status**: 200 OK
- **Failure Status**: 500 Internal Server Error
- **Metrics Format**: Prometheus exposition format

## Prometheus Metrics

All metrics are exposed at `/metrics` endpoint and follow Prometheus naming conventions.

### Event Metrics

#### `kube9_operator_events_received_total`
- **Type**: Counter
- **Description**: Total number of Kubernetes events received by the watcher
- **Labels**:
  - `type`: K8s event type (e.g., "Warning", "Normal", "Error")

#### `kube9_operator_events_stored_total`
- **Type**: Counter
- **Description**: Total number of events successfully written to the database
- **Labels**:
  - `event_type`: Normalized event type (e.g., "operator", "insight", "kubernetes")
  - `severity`: Event severity (e.g., "info", "warning", "error", "critical")

#### `kube9_operator_events_errors_total`
- **Type**: Counter
- **Description**: Total number of errors encountered during event processing
- **Labels**:
  - `reason`: Error reason (e.g., "normalization_failed", "db_write_failed", "queue_full")

#### `kube9_operator_events_queue_size`
- **Type**: Gauge
- **Description**: Current number of events in the async processing queue
- **Use Case**: Monitor queue depth to detect processing bottlenecks

#### `kube9_operator_events_dropped_total`
- **Type**: Counter
- **Description**: Total number of events dropped due to queue being full (max queue size: 1000)

#### `kube9_operator_events_storage_size_bytes`
- **Type**: Gauge
- **Description**: Current size of the event database file in bytes

#### `kube9_operator_event_listener_healthy`
- **Type**: Gauge
- **Description**: Event listener health status (1 = healthy, 0 = unhealthy)

### Collection Metrics

#### `kube9_operator_collection_total`
- **Type**: Counter
- **Description**: Total number of collection attempts by type and status
- **Labels**:
  - `type`: Collection type (e.g., "cluster-metadata", "resource-inventory", "resource-configuration-patterns")
  - `status`: Collection status ("success" or "failed")

#### `kube9_operator_collection_duration_seconds`
- **Type**: Histogram
- **Description**: Duration of collection operations in seconds
- **Labels**:
  - `type`: Collection type
- **Buckets**: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120] seconds

#### `kube9_operator_collection_last_success`
- **Type**: Gauge
- **Description**: Unix timestamp of last successful collection by type
- **Labels**:
  - `type`: Collection type

### Metrics Registry
- All metrics are registered in a single Prometheus registry
- Metrics are collected from multiple modules (events, collection)
- Registry is exported for use by health server

## Health Check Logic

### Liveness Check Details
- **Implementation**: `checkLiveness()` in `src/health/checks.ts`
- **Checks**:
  1. Kubernetes API connectivity via `kubernetesClient.getClusterInfo()`
  2. Event listener health via `getEventListenerHealth()`
  3. Verifies `isWatching` flag is true
- **Timeout**: 5 seconds
- **Failure Response**: Returns 500 with error message

### Readiness Check Details
- **Implementation**: `checkReadiness()` in `src/health/checks.ts`
- **Checks**:
  1. Operator initialization status via `getInitialized()`
  2. ConfigMap write capability via `testConfigMapWrite()`
     - Creates/updates test ConfigMap: `kube9-operator-health-check`
     - Validates RBAC permissions and cluster connectivity
  3. Event listener health via `getEventListenerHealth()`
- **Timeout**: 5 seconds
- **Failure Response**: Returns 503 with error message

### Event Listener Health
- **Implementation**: `getEventListenerHealth()` in `src/events/health.ts`
- **Checks**:
  - Event watcher initialization status
  - Event watcher health (`isHealthy()`)
  - Last event timestamp
  - Queue size
  - Dropped events count
- **Stall Detection**: Event listener considered unhealthy if not watching
- **Integration**: Used by both liveness and readiness probes

## Logging

### Logger Configuration
- **Library**: Winston
- **Format**: JSON (structured logging)
- **Output**: Console (stdout) - Kubernetes best practice
- **Timestamp Format**: `YYYY-MM-DD HH:mm:ss.SSS` (ISO-like format)
- **Error Handling**: Includes stack traces for errors
- **Exit Behavior**: Does not exit on handled exceptions

### Log Levels
- **Configurable via**: `LOG_LEVEL` environment variable (set via Helm `logLevel` value)
- **Valid Levels**: `error`, `warn`, `info`, `debug`
- **Default**: `info`
- **Usage**:
  - `error`: Critical errors requiring immediate attention
  - `warn`: Warning conditions that may need attention
  - `info`: General informational messages (default)
  - `debug`: Detailed debugging information

### Structured Logging
- All log entries are JSON-formatted for easy parsing
- Log aggregation systems (e.g., ELK, Loki) can parse automatically
- Includes contextual information:
  - Timestamps
  - Log levels
  - Error stacks
  - Custom metadata fields

### Logging Best Practices
- Use appropriate log levels
- Include relevant context in log messages
- Structured data aids troubleshooting
- Logs are collected by Kubernetes and can be forwarded to external systems
