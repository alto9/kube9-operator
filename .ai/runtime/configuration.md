# Configuration

## Environment Variables

### Optional
- **POD_NAMESPACE**: Operator namespace (from Kubernetes downward API)
  - Default: `kube9-system`
  - Used for ConfigMap status updates and namespace identification

- **LOG_LEVEL**: Logging verbosity level
  - Values: `debug`, `info`, `warn`, `error`
  - Default: `info`

- **DB_PATH**: Database storage directory path
  - Default: `/data`
  - Database file stored at `{DB_PATH}/kube9.db`
  - Used for SQLite database persistence (events, assessments, collections)
  - Host development: `npm run dev` / `npm run dev:watch` default to `<repo>/.kube9-data` when `DB_PATH` is unset

- **HEALTH_PORT**: HTTP port for `/healthz`, `/readyz`, and `/metrics`
  - Default: `8080`
  - Set when another process already uses port 8080 on the developer machine

- **STATUS_UPDATE_INTERVAL_SECONDS**: Status ConfigMap update frequency
  - Default: `60` (1 minute)
  - How often operator writes status to ConfigMap

### Collection Interval Environment Variables
- **CLUSTER_METADATA_INTERVAL_SECONDS**: Cluster metadata collection interval
  - Default: `86400` (24 hours)
  - Minimum enforced: `3600` (1 hour)
  - Random offset range: 0-1 hour

- **RESOURCE_INVENTORY_INTERVAL_SECONDS**: Resource inventory collection interval
  - Default: `21600` (6 hours)
  - Minimum enforced: `1800` (30 minutes)
  - Random offset range: 0-30 minutes

- **RESOURCE_CONFIGURATION_PATTERNS_INTERVAL_SECONDS**: Configuration patterns collection interval
  - Default: `43200` (12 hours)
  - Minimum enforced: `3600` (1 hour)
  - Random offset range: 0-1 hour

- **PERFORMANCE_METRICS_INTERVAL_SECONDS**: Performance metrics collection interval (Prometheus-backed)
  - Default: `900` (15 minutes)
  - Minimum enforced: `300` (5 minutes)
  - Random offset range: 0–300 seconds (0–5 minutes)
  - Invalid or below-minimum values fail config load (match existing interval fail-fast), not silent clamp after ready

- **SECURITY_POSTURE_INTERVAL_SECONDS**: Security posture collection interval (cluster API aggregates)
  - Default target: `86400` (24 hours); exact default/min/offset candidates under Open implementation decisions (security-posture collector scope)
  - Enforced minimum and random offset required
  - Invalid or below-minimum values fail config load

### Performance metrics / Prometheus outbound (optional)

Optional **operator → in-cluster Prometheus** client used only by the performance metrics collector. Distinct from the operator’s own `/metrics` exposition on `HEALTH_PORT`. Same optional-outbound family as Trivy / Argo CD HTTP (not a new trust boundary and not a readiness gate).

- **Registration:** Config-gated. Register the performance collector on `CollectionScheduler` only when `PROMETHEUS_BASE_URL` is non-empty. No separate `*_ENABLED` flag in v1. When unset, do not schedule performance ticks and do not treat absence as config failure.
- **Connection env (runtime contract):**
  - `PROMETHEUS_BASE_URL` — base URL for PromQL HTTP API; non-empty gates registration; malformed when set → fail config load; unset → soft miss
  - `PROMETHEUS_TIMEOUT_MS` — default `30000`, minimum `1000`; invalid → fail config load
  - `PROMETHEUS_TLS_INSECURE` — default `false`
- **v1 auth:** URL + timeout + TLS only. Do not send the operator ServiceAccount token as an implicit Prometheus credential. Optional bearer / existingSecret mount is packaging backlog (chart peer); not required for collector accept.
- **When registered but unreachable / unusable:** Log warn; omit a `collections` row; count the tick as **failed** for collection metrics and `totalFailureCount`; retry next interval. Do not fail `/readyz`, do not stop other collectors, do not persist `source.available: false` marker rows, and do not require metrics-server / Kubernetes metrics API fallback.
- **Helm:** Chart wiring for interval and Prometheus env keys is owned by operations (`build_packaging.md` / chart values); runtime owns env semantics and validation.

### Security posture collector

- Always runnable from cluster API reads alone (no Prometheus, no Trivy dependency).
- **Registration:** Always register on `CollectionScheduler` during serve bootstrap (core-collector pattern), unless an explicit enable flag is added for symmetry (Open implementation decisions; default remains always-on).
- Uses `SECURITY_POSTURE_INTERVAL_SECONDS` and SQLite `collections` like peer collectors. No phone-home / kube9-api registration path.

### Kubernetes AI Conformance Environment Variables
- **AI_CONFORMANCE_ENABLED**: Enable scheduled Kubernetes AI Conformance readiness evaluation
  - Default: `true` once the M10 feature is shipped
  - When false, on-demand CLI evaluation remains available if implemented

- **AI_CONFORMANCE_INTERVAL_SECONDS**: Scheduled conformance evaluation interval
  - Default: `86400` (24 hours)
  - Minimum enforced: `3600` (1 hour)
  - Random offset should be applied to avoid thundering herd behavior

- **AI_CONFORMANCE_CHECKLIST_SOURCE**: Optional packaged checklist source selector
  - Default: bundled operator checklist data
  - Used only to select among packaged/supported sources; the operator must not fetch arbitrary remote YAML at runtime by default

### Event Retention Environment Variables
- **EVENT_RETENTION_INFO_WARNING_DAYS**: Retention period for info/warning events
  - Default: `7` days
  - Events with info or warning severity are retained for this period

- **EVENT_RETENTION_ERROR_CRITICAL_DAYS**: Retention period for error/critical events
  - Default: `30` days
  - Events with error or critical severity are retained for this period

**Agent and Desktop consumers:** These env vars (and Helm `events.retention.*`) define the **effective store window** for `query events list` / `get` after `RetentionCleanup` runs every **6 hours** (plus immediate run on service start). Consumers filter with `--since` / `--until` against still-stored rows; query JSON does not echo configured retention days. See [`.ai/data/consistency.md`](../data/consistency.md).

### ArgoCD Configuration Environment Variables
- **ARGOCD_AUTO_DETECT**: Enable automatic ArgoCD detection
  - Default: `true` (unless set to `"false"`)
  - When enabled, operator periodically detects ArgoCD installation

- **ARGOCD_ENABLED**: Explicitly enable/disable ArgoCD integration
  - Optional: `"true"` to enable, `undefined`/unset for auto-detect behavior
  - Overrides auto-detection when explicitly set

- **ARGOCD_NAMESPACE**: Custom namespace where ArgoCD is installed
  - Default: `argocd`
  - Namespace to search for ArgoCD server deployment

- **ARGOCD_SELECTOR**: Label selector for ArgoCD server deployment
  - Default: `app.kubernetes.io/name=argocd-server`
  - Kubernetes label selector used to find ArgoCD server pods

- **ARGOCD_DETECTION_INTERVAL**: Detection check interval in hours
  - Default: `6` hours
  - How often operator checks for ArgoCD installation changes

### Argo CD API (HTTP) Environment Variables

Used by M9 application-status collection and M17 resource-tree query/probe. Chart wires the same names.

- **ARGOCD_API_COLLECTION_ENABLED**: Enable periodic Application list/status collection (M9)
  - Default: `true`

- **ARGOCD_API_BASE_URL**: Explicit HTTPS base URL for argocd-server
  - Default: empty (derive `https://{ARGOCD_API_SERVER_SERVICE_NAME}.{detectedNamespace}.svc.cluster.local`)

- **ARGOCD_API_SERVER_SERVICE_NAME**: Service name segment for derived URL
  - Default: `argocd-server`

- **ARGOCD_API_TIMEOUT_MS**: HTTP timeout for each Argo CD API request (including resource-tree get and capability probe)
  - Default: `30000`
  - Minimum: `1000`

- **ARGOCD_API_TLS_INSECURE**: Skip TLS verification for argocd-server HTTPS
  - Default: `false`
  - Not recommended for production

- **ARGOCD_API_BEARER_TOKEN**: Dedicated Argo CD API bearer token (preferred for M17)
  - Optional string; when non-empty, used for resource-tree auth

- **ARGOCD_API_TOKEN_FILE**: Path to a file containing the dedicated bearer token
  - Used when `ARGOCD_API_BEARER_TOKEN` is unset/empty
  - **Resource-tree path (M17):** must resolve a dedicated token from bearer env or this file; **must not** fall back to `/var/run/secrets/kubernetes.io/serviceaccount/token`
  - M9 application-status collection may still allow SA fallback until a later hardening story; resource-tree does not share that fallback

## Helm Values

### Image Configuration
```yaml
image:
  repository: ghcr.io/alto9/kube9-operator
  tag: "1.3.0"
  pullPolicy: IfNotPresent
```

### Resource Requests and Limits
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```
- Uses Guaranteed QoS (requests = limits) for stable performance
- 1Gi memory needed to handle CLI exec spawning separate Node.js processes

### Service Account Configuration
```yaml
serviceAccount:
  create: true
  name: "kube9-operator"
```

### RBAC Configuration
```yaml
rbac:
  create: true
```
- Creates ClusterRole and ClusterRoleBinding for operator permissions

### Log Level
```yaml
logLevel: "info"
```
- Values: `debug`, `info`, `warn`, `error`
- Sets `LOG_LEVEL` environment variable

### Status Update Interval
```yaml
statusUpdateIntervalSeconds: 60
```
- Sets `STATUS_UPDATE_INTERVAL_SECONDS` environment variable
- ConfigMap update frequency in seconds

### ArgoCD Configuration
```yaml
argocd:
  autoDetect: true              # Enable automatic detection (default: true)
  # enabled: true               # Optional: explicitly enable/disable
  # namespace: "argocd"         # Custom namespace (default: "argocd")
  # selector: "app.kubernetes.io/name=argocd-server"  # Custom selector
  detectionInterval: 6          # Detection check interval in hours (default: 6)
  api:
    collectionEnabled: true     # M9 Application status collection
    # baseUrl: ""               # Optional explicit HTTPS base URL
    timeoutMs: 30000            # Shared by collection, probe, and resource-tree get
    tlsInsecure: false
    serverServiceName: argocd-server
    token:
      # Name of an existing Secret in the release namespace (platform-created out-of-band).
      # Empty/unset = default-off: no volume mount and no ARGOCD_API_TOKEN_FILE.
      existingSecret: ""
      # Key within that Secret holding the bearer token string.
      existingSecretKey: token
```
- Maps to `ARGOCD_*` and `ARGOCD_API_*` environment variables
- **Dedicated API token (M17 onboarding):** When `argocd.api.token.existingSecret` is non-empty, the chart volume-mounts that Secret key at `/var/run/secrets/kube9/argocd-api-token` and sets `ARGOCD_API_TOKEN_FILE` to that path. Chart does **not** create a Secret from a plaintext bearer value in Helm values.
- Resource-tree requires a dedicated bearer (`ARGOCD_API_BEARER_TOKEN` or `ARGOCD_API_TOKEN_FILE`); no SA fallback on that path. File mount alone satisfies resolution order (bearer env first, then token file).
- When `existingSecret` is set but the Secret is absent, Kubernetes fails the pod mount (not a soft runtime miss). When unset, install succeeds; runtime reports `ARGOCD_TOKEN_MISSING` / `resourceTreeCapable: false` for the resource-tree path.

### Collection Interval Configuration
```yaml
metrics:
  intervals:
    clusterMetadata: 86400                    # 24 hours (default), minimum 3600 (1h)
    resourceInventory: 21600                  # 6 hours (default), minimum 1800 (30m)
    resourceConfigurationPatterns: 43200     # 12 hours (default), minimum 3600 (1h)
    performanceMetrics: 900                   # 15 minutes (default); minimum 300; offset 0–300s
    securityPosture: 86400                    # 24 hours (target default); min/offset under security-posture Open implementation decisions
```
- Maps to `*_INTERVAL_SECONDS` environment variables
- Operator enforces minimum intervals to prevent abuse
- Performance metrics also need optional Prometheus client values mapped to `PROMETHEUS_BASE_URL`, `PROMETHEUS_TIMEOUT_MS`, `PROMETHEUS_TLS_INSECURE` (Helm values-tree shape is packaging peer). Chart RBAC and ServiceMonitor ownership stay in operations; runtime only loads the env contract and must not treat Prometheus as required for ready.

### Kubernetes AI Conformance Configuration
```yaml
aiConformance:
  enabled: true
  intervalSeconds: 86400
  checklistSource: bundled
```
- Maps to `AI_CONFORMANCE_*` environment variables.
- Controls scheduled readiness evaluation only; the status writer can still publish the last persisted result.
- The checklist source is packaged with the operator image/chart. Runtime network fetch is out of scope unless explicitly added by a future contract.

### Event Storage Configuration
```yaml
events:
  persistence:
    enabled: true              # Enable PersistentVolume (default: true)
    size: 5Gi                 # Volume size
    storageClassName: ""      # Uses cluster default if not specified
    accessMode: ReadWriteOnce
    
  retention:
    infoWarning: 7            # Info/warning events retained for 7 days
    errorCritical: 30         # Error/critical events retained for 30 days
```
- Maps to `EVENT_RETENTION_*_DAYS` environment variables
- PersistentVolume stores SQLite database at `/data/kube9.db`

## In-Cluster Configuration

### Kubernetes API Access
- Uses service account token mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`
- No kubeconfig file required for in-cluster operation
- Kubernetes client auto-detects in-cluster configuration

### Service Account Token
- Automatically mounted by Kubernetes when running in a pod
- Used for authenticating to Kubernetes API server
- Required for:
  - Reading cluster metadata
  - Watching Kubernetes events
  - Updating status ConfigMap
  - Detecting ArgoCD installations
  - Security posture cluster API aggregates (read-only)

## Open implementation decisions

### Resolved (performance-metrics interval, registration, Prometheus env)

- Interval: `PERFORMANCE_METRICS_INTERVAL_SECONDS` ↔ Helm `metrics.intervals.performanceMetrics`; default `900`, minimum `300`, random offset `0–300`. Fail-fast on invalid / below-minimum.
- Registration: config-gated on non-empty `PROMETHEUS_BASE_URL` (no separate enable flag in v1). Always-register-with-degrade is rejected.
- Prometheus outbound: `PROMETHEUS_BASE_URL`, `PROMETHEUS_TIMEOUT_MS` (default `30000`, min `1000`), `PROMETHEUS_TLS_INSECURE` (default `false`). v1 URL+TLS only; never implicit SA token.
- Degrade when registered but unreachable/unusable: omit `collections` row; count tick as **failed** (metrics + `totalFailureCount`); do not flip `/readyz` or promote reserved `health: degraded`. When URL unset: no performance ticks.
- Ops vs runtime home: env semantics and load/validation live here. Helm values-tree shape, RBAC for posture, and ServiceMonitor for operator `/metrics` stay in operations with a pointer back to these env names.

### Security-posture collector — peer issue scope

- Interval env / Helm keys: `SECURITY_POSTURE_INTERVAL_SECONDS` ↔ `metrics.intervals.securityPosture` (candidates: default `86400`, minimum `3600`, offset `0–3600`) remain locked with the security-posture collector / packaging peers.
- Registration: always-on (no enable flag unless chart symmetry adds default-on). Not owned by performance-metrics.
