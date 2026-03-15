# Startup Bootstrap

## Startup Sequence

The operator follows a strict initialization sequence defined in `src/operator.ts`. Each step must complete successfully before proceeding to the next.

### 1. Load Configuration
- Loads configuration from environment variables via `loadConfig()`
- Validates required variables (e.g., `SERVER_URL`)
- Sets defaults for optional variables
- Logs configuration (excluding sensitive data)
- Sets global config singleton via `setConfig()`

**Configuration loaded:**
- `serverUrl`, `logLevel`, `statusUpdateIntervalSeconds`
- `reregistrationIntervalHours`
- Collection intervals (`clusterMetadataIntervalSeconds`, `resourceInventoryIntervalSeconds`, `resourceConfigurationPatternsIntervalSeconds`)
- Event retention policies (`eventRetentionInfoWarningDays`, `eventRetentionErrorCriticalDays`)

### 2. Start Health Server
- Starts HTTP health server on port 8080 via `startHealthServer(8080)`
- Provides endpoints:
  - `/healthz` - Liveness probe (always returns 200 once started)
  - `/readyz` - Readiness probe (returns 200 only after initialization complete)
  - `/metrics` - Prometheus metrics endpoint
- Started early so probes are available during initialization
- Uses Express.js for HTTP server

### 3. Initialize Database Schema
- Creates `SchemaManager` instance
- Initializes SQLite database schema via `schemaManager.initialize()`
- Database file location: `{DB_PATH}/kube9.db` (default: `/data/kube9.db`)
- Creates tables for events, assessments, collections
- Configures SQLite pragmas (WAL mode, foreign keys, cache size)

### 4. Start Event System
- Creates and starts `EventQueueWorker` instance
  - Processes events from in-memory queue
  - Writes events to database asynchronously
- Creates and starts `KubernetesEventWatcher` instance
  - Watches Kubernetes Events API
  - Filters and queues relevant events
- Registers event watcher for health checks
- Event system runs independently of main reconcile loop

### 5. Test Kubernetes Client
- Tests Kubernetes API connectivity via `kubernetesClient.getClusterInfo()`
- Retrieves cluster version and node count
- Logs warning (not error) if connection fails (expected outside cluster)
- Operator continues initialization even if test fails

### 6. Perform Initial ArgoCD Detection
- Parses ArgoCD configuration from environment variables:
  - `ARGOCD_AUTO_DETECT` (default: true)
  - `ARGOCD_ENABLED` (optional)
  - `ARGOCD_NAMESPACE` (default: "argocd")
  - `ARGOCD_SELECTOR` (default: "app.kubernetes.io/name=argocd-server")
  - `ARGOCD_DETECTION_INTERVAL` (default: 6 hours)
- Performs initial ArgoCD detection with timeout
- Updates ArgoCD status tracker with detection result
- Logs detection result (detected/not detected, namespace, version if found)
- Continues even if detection fails (warns but doesn't error)

### 7. Start ArgoCD Detection Manager
- Creates `ArgoCDDetectionManager` instance
- Starts periodic ArgoCD detection
- Runs detection checks at configured interval (default: every 6 hours)
- Updates status when ArgoCD installation state changes

### 8. Start Status Writer
- Creates `StatusWriter` instance with Kubernetes client and update interval
- Starts periodic status update loop
- Updates ConfigMap with operator status every `statusUpdateIntervalSeconds` (default: 60s)
- Status includes: mode, tier, version, health, registration state, collection stats, ArgoCD status

### 9. Initialize Collection Scheduler
- Creates `CollectionScheduler` instance
- Creates `LocalStorage` instance for local data storage
- Initializes collectors:
  - **ClusterMetadataCollector**: Collects cluster metadata
    - Interval: `clusterMetadataIntervalSeconds` (default: 86400 = 24h)
    - Minimum interval: 3600s (1 hour)
    - Random offset: 0-1 hour
  - **ResourceInventoryCollector**: Collects resource inventory
    - Interval: `resourceInventoryIntervalSeconds` (default: 21600 = 6h)
    - Minimum interval: 1800s (30 minutes)
    - Random offset: 0-30 minutes
  - **ResourceConfigurationPatternsCollector**: Collects configuration patterns
    - Interval: `resourceConfigurationPatternsIntervalSeconds` (default: 43200 = 12h)
    - Minimum interval: 3600s (1 hour)
    - Random offset: 0-1 hour
- Registers each collector with scheduler
- Starts scheduler (begins periodic collection tasks)
- Collection failures are logged but don't stop operator
- Collection metrics are recorded for monitoring

### 10. Register Signal Handlers
- Registers `SIGTERM` handler for graceful shutdown
- Registers `SIGINT` handler for graceful shutdown (Ctrl+C)
- Both handlers call `gracefulShutdown()` with all component references
- Handlers prevent multiple shutdown attempts

### 11. Mark as Initialized
- Calls `setInitialized(true)` to mark operator as ready
- Readiness probe (`/readyz`) now returns 200
- Operator is fully operational

## Error Handling

- Configuration loading failures: Operator exits with code 1
- Database initialization failures: Operator exits with code 1
- Kubernetes client test failures: Logged as warning, operator continues
- ArgoCD detection failures: Logged as warning, operator continues
- Collection initialization failures: Logged as error, operator continues (can function without collection)
- All other failures during startup: Operator exits with code 1

## Initialization Logging

Each step logs its progress:
- `"kube9-operator starting..."`
- `"Loading configuration..."`
- `"Configuration loaded"` (with non-sensitive config values)
- `"Initializing database schema..."`
- `"Starting event system..."`
- `"Event system started"`
- `"Testing Kubernetes client..."`
- `"Performing initial ArgoCD detection"`
- `"Starting status writer..."`
- `"Initializing collection scheduler..."`
- `"Collection initialization completed successfully"`
- `"kube9-operator initialized successfully"`

## Startup Time Considerations

- Health server starts immediately (probes available early)
- Database initialization is synchronous (fast with SQLite)
- Event system starts before main reconcile loop
- Initial ArgoCD detection has timeout to prevent blocking
- Collection scheduler starts after all other systems
- Total startup time typically < 5 seconds
