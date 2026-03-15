# User Stories

## Status Exposure

### ConfigMap Details
- **Name**: `kube9-operator-status` (defined in `src/status/writer.ts` as `STATUS_CONFIGMAP_NAME`)
- **Namespace**: Operator namespace (default `kube9-system`, exposed via `status.namespace` field)
- **Key**: `status` (JSON string)
- **Update interval**: 60 seconds (configurable via `statusUpdateIntervalSeconds` in Helm values)
- **Stale threshold**: 5 minutes - extension treats status as degraded/unhealthy if `lastUpdate` > 5 minutes old

### Status Schema
- `mode`: "operated" (always when operator running)
- `tier`: "free" (always in current implementation)
- `version`: Operator semantic version
- `health`: "healthy" | "degraded" | "unhealthy"
- `lastUpdate`: ISO 8601 timestamp
- `error`: Error message if health is degraded/unhealthy, null otherwise
- `namespace`: Operator deployment namespace
- `collectionStats`: Collection success/failure statistics
- `argocd`: ArgoCD detection status

### Extension Behavior
- Extension queries operator status → returns operated, tier free
- Extension detects operator not installed → basic mode, installation prompts
- Extension reads ConfigMap from default namespace, then uses `namespace` field for subsequent operations

**Implementation**: Status written by `StatusWriter` class (`src/status/writer.ts`) which periodically calls `calculateStatus()` from `src/status/calculator.ts`.

## ArgoCD Awareness

### Detection Mechanism
1. **CRD Check**: Verifies `applications.argoproj.io` CRD exists in cluster
2. **Deployment Check**: Verifies ArgoCD server deployment exists in target namespace
3. **Version Extraction**: Extracts ArgoCD version from deployment image tag

### Configuration Options
- **autoDetect**: Enable automatic detection (default: true)
- **enabled**: Explicitly enable/disable (overrides autoDetect)
- **namespace**: Custom namespace (default: "argocd")
- **selector**: Custom label selector for server deployment (default: "app.kubernetes.io/name=argocd-server")
- **detectionInterval**: Periodic refresh interval in hours (default: 6)

### Behavior
- ArgoCD detected → status includes `argocd.detected: true`, namespace, version, lastChecked
- ArgoCD not installed → graceful degradation, `argocd.detected: false`
- Detection timeout → returns not detected (30s timeout protection)
- Periodic refresh → re-checks every 6 hours (configurable) via `ArgoCDDetectionManager`

**Implementation**: Detection logic in `src/argocd/detection.ts`, periodic management in `src/argocd/detection-manager.ts`. Status exposed via `status.argocd` field in ConfigMap.

### Future (M9)
- Application sync/health status
- Drift detection
- VS Code extension reads ArgoCD status for conditional features

## Event System

### Event Types
- **cluster**: Kubernetes cluster events (Pod failures, node issues, etc.)
- **operator**: Operator lifecycle events (startup, shutdown, health transitions)
- **insight**: Generated insights and recommendations
- **assessment**: Assessment run events
- **health**: Health check events
- **system**: System-level events

### Severity Levels
- **info**: Informational events
- **warning**: Warning-level events
- **error**: Error-level events
- **critical**: Critical failures requiring immediate attention

### Recording Mechanism
- **Non-blocking**: Event recording uses async queue (`EventQueueWorker`)
- **Queue-based**: Events enqueued immediately, processed in batches (max 10 per cycle)
- **Graceful degradation**: Database write failures logged but don't crash operator
- **Metrics**: Events tracked with Prometheus metrics (events_stored_total, events_errors_total)

### Query Capabilities
Events queryable via CLI (`kube9 events list`) with filters:
- **type**: Filter by event type (cluster, operator, insight, assessment, health, system)
- **severity**: Filter by severity (info, warning, error, critical)
- **since/until**: Filter by date range (ISO 8601 datetime)
- **objectKind**: Filter by Kubernetes object kind
- **objectNamespace**: Filter by Kubernetes object namespace
- **objectName**: Filter by Kubernetes object name
- **limit/offset**: Pagination support (max 1000 per query)

**Implementation**: Event types and severities defined in `src/types/event.ts`. Recording via `EventRecorder` (`src/events/event-recorder.ts`), queue processing via `EventQueueWorker` (`src/events/queue-worker.ts`), querying via `EventRepository` (`src/database/event-repository.ts`), CLI commands in `src/cli/commands/events.ts`.

## Data Collection (M8)

### Implemented Collectors
1. **ClusterMetadataCollector** (`src/collection/collectors/cluster-metadata.ts`)
   - Collects: Kubernetes version, cluster identifier, node count, provider, region/zone
   - Interval: 24h default (86400s), 3600s minimum
   - Random offset: 0-1 hour

2. **ResourceInventoryCollector** (`src/collection/collectors/resource-inventory.ts`)
   - Collects: Namespace counts (hashed IDs), pod/deployment/statefulset/replicaset/service counts
   - Interval: 6h default (21600s), 1800s minimum
   - Random offset: 0-1 hour

3. **ResourceConfigurationPatternsCollector** (`src/collection/collectors/resource-configuration-patterns.ts`)
   - Collects: Limits/requests, replica counts, image pull policies, security contexts, probes, volume types, service types
   - Interval: 12h default (43200s), 3600s minimum
   - Random offset: 0-1 hour

### Collection Behavior
- **Scheduled**: Collections registered with `CollectionScheduler` (`src/collection/scheduler.ts`)
- **Random offset**: Each collection scheduled with 0-1 hour random offset to distribute load
- **Error handling**: Collection errors logged, metrics recorded, but don't crash operator
- **Retry**: Failed collections retry on next scheduled interval (no immediate retry)
- **Statistics**: Collection success/failure tracked in `CollectionStatsTracker` and exposed in status ConfigMap

**Implementation**: Collectors initialized in `src/operator.ts`, scheduled via `CollectionScheduler`, stored locally via `LocalStorage` (`src/collection/storage.ts`).
