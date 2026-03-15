# Execution Model

## Dual-Mode Binary

The kube9-operator binary supports multiple execution modes via Commander.js CLI framework (`src/index.ts`):

### serve (Default Mode)
- **Command**: `kube9-operator serve` or `kube9-operator` (default command)
- **Purpose**: Runs the operator control loop
- **Behavior**:
  - Loads configuration
  - Starts health server (port 8080)
  - Initializes database schema
  - Starts event system (EventQueueWorker, KubernetesEventWatcher)
  - Performs initial ArgoCD detection
  - Starts ArgoCD detection manager
  - Starts status writer (periodic ConfigMap updates)
  - Initializes collection scheduler
  - Registers collectors (cluster metadata, resource inventory, configuration patterns)
  - Registers signal handlers (SIGTERM, SIGINT)
  - Runs indefinitely until shutdown signal
- **Use Case**: Primary operator deployment mode

### query (CLI Mode)
- **Command**: `kube9-operator query <subcommand>`
- **Purpose**: Query stored data via kubectl exec
- **Subcommands**:
  - `query status` - Operator status, health, registration
  - `query events list` - List events with filters (type, severity, since)
  - `query events get <id>` - Get specific event by ID
- **Behavior**:
  - Reads from SQLite database
  - Outputs JSON/YAML/table format
  - Exits after command completion
- **Use Case**: Data access from operator pod via `kubectl exec`

### assess (Assessment Mode)
- **Command**: `kube9-operator assess <subcommand>`
- **Purpose**: Well-Architected Framework assessment operations
- **Subcommands**:
  - `assess run` - Run an assessment (full, pillar, or single-check mode)
  - `assess list` - List assessment runs with filters
  - `assess get <id>` - Get specific assessment by run ID
  - `assess summary` - Current compliance summary across all pillars
  - `assess history` - Historical results for trending
- **Behavior**:
  - Loads configuration and initializes assessment registry
  - Runs assessments using AssessmentRunner
  - Reads/writes assessment results to database
  - Outputs results in specified format
  - Exits after command completion
- **Use Case**: On-demand assessment execution via `kubectl exec`

## Runtime Environment

### Node.js 22
- **Version**: Node.js 22
- **Process Model**: Single process
- **Concurrency**: Event-driven, asynchronous I/O
- **Memory**: Default 1Gi limit (configurable via Helm)

### Database
- **Database**: SQLite (better-sqlite3)
- **Mode**: Synchronous (better-sqlite3 is synchronous)
- **Location**: `{DB_PATH}/kube9.db` (default: `/data/kube9.db`)
- **Configuration**:
  - WAL mode enabled (Write-Ahead Logging for concurrency)
  - Synchronous mode: NORMAL
  - Foreign keys: ON
  - Cache size: 10MB
- **Persistence**: PersistentVolume (5Gi default) when `events.persistence.enabled: true`
- **No async database**: Uses synchronous better-sqlite3 API

## Reconcile Loop Components

### Status Update Loop
- **Component**: `StatusWriter`
- **Interval**: Every `statusUpdateIntervalSeconds` (default: 60 seconds)
- **Action**: Updates ConfigMap with current operator status
- **Status Includes**:
  - Mode (operated), tier (free), version
  - Health status (healthy/unhealthy)
  - Registration state (registered, clusterId)
  - Collection statistics (success/failure counts, last success time)
  - ArgoCD status (detected, namespace, version)
  - Last update timestamp
  - Error message (if unhealthy)

### Collection Scheduler
- **Component**: `CollectionScheduler`
- **Purpose**: Manages periodic data collection tasks
- **Tasks**:
  1. **Cluster Metadata Collection**
     - Interval: `clusterMetadataIntervalSeconds` (default: 86400s = 24h)
     - Minimum: 3600s (1h)
     - Random offset: 0-1 hour
     - Collector: `ClusterMetadataCollector`
  
  2. **Resource Inventory Collection**
     - Interval: `resourceInventoryIntervalSeconds` (default: 21600s = 6h)
     - Minimum: 1800s (30m)
     - Random offset: 0-30 minutes
     - Collector: `ResourceInventoryCollector`
  
  3. **Resource Configuration Patterns Collection**
     - Interval: `resourceConfigurationPatternsIntervalSeconds` (default: 43200s = 12h)
     - Minimum: 3600s (1h)
     - Random offset: 0-1 hour
     - Collector: `ResourceConfigurationPatternsCollector`
- **Randomization**: Random offsets prevent thundering herd when multiple operators run
- **Error Handling**: Collection failures are logged and metrics recorded, but don't stop scheduler

### Event Watcher
- **Component**: `KubernetesEventWatcher`
- **Mode**: Continuous watch on Kubernetes Events API
- **Action**: Watches all namespaces for Kubernetes events
- **Filtering**: Filters events based on relevance criteria
- **Queueing**: Queues filtered events for processing
- **Health**: Registered with health check system

### Event Queue Worker
- **Component**: `EventQueueWorker`
- **Mode**: Continuous processing of event queue
- **Action**: Processes queued events and writes to SQLite database
- **Concurrency**: Handles events asynchronously
- **Persistence**: All events written to database

### ArgoCD Detection Manager
- **Component**: `ArgoCDDetectionManager`
- **Interval**: Every `ARGOCD_DETECTION_INTERVAL` hours (default: 6 hours)
- **Action**: Periodically checks for ArgoCD installation
- **Detection**: Searches for ArgoCD server deployment using namespace and selector
- **Status Updates**: Updates ArgoCD status tracker when detection state changes

## Health Server

- **Port**: 8080 (configurable, default 8080)
- **Framework**: Express.js
- **Endpoints**:
  - `GET /healthz` - Liveness probe (always 200 once started)
  - `GET /readyz` - Readiness probe (200 only after initialization complete)
  - `GET /metrics` - Prometheus metrics endpoint
- **Startup**: Started early in initialization sequence
- **Shutdown**: Stopped during graceful shutdown

## Process Boundaries

- **Single Process**: All components run in single Node.js process
- **No Workers**: No worker threads or child processes for main operator loop
- **CLI Exec**: Query/assess commands spawn separate Node.js processes when invoked via `kubectl exec`
- **Memory Isolation**: Each CLI exec creates new process with its own memory space

## Event Loop

- **Model**: Node.js event loop (single-threaded, event-driven)
- **Non-blocking I/O**: All I/O operations are asynchronous (except SQLite which is synchronous)
- **Concurrency**: Handles multiple concurrent operations via event loop
- **Blocking Operations**: SQLite operations are synchronous but fast (local file system)

## Resource Usage

- **Memory**: 1Gi request/limit (Guaranteed QoS)
- **CPU**: 500m request/limit
- **Storage**: 5Gi PersistentVolume (when persistence enabled)
- **Network**: HTTP health server (port 8080), Kubernetes API client
