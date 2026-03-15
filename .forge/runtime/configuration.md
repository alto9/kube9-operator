# Configuration

## Environment Variables

### Required
- **SERVER_URL**: kube9-server base URL (required, no default)
  - Example: `https://api.kube9.io`
  - Used for pro tier registration and data transmission

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

- **STATUS_UPDATE_INTERVAL_SECONDS**: Status ConfigMap update frequency
  - Default: `60` (1 minute)
  - How often operator writes status to ConfigMap

- **REREGISTRATION_INTERVAL_HOURS**: Re-registration interval with server
  - Default: `24` (24 hours)
  - How often operator re-registers with kube9-server

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

### Event Retention Environment Variables
- **EVENT_RETENTION_INFO_WARNING_DAYS**: Retention period for info/warning events
  - Default: `7` days
  - Events with info or warning severity are retained for this period

- **EVENT_RETENTION_ERROR_CRITICAL_DAYS**: Retention period for error/critical events
  - Default: `30` days
  - Events with error or critical severity are retained for this period

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

### Re-registration Interval
```yaml
reregistrationIntervalHours: 24
```
- Sets `REREGISTRATION_INTERVAL_HOURS` environment variable

### Server URL
```yaml
serverUrl: "https://api.kube9.io"
```
- Sets `SERVER_URL` environment variable
- kube9-server URL for pro tier registration

### ArgoCD Configuration
```yaml
argocd:
  autoDetect: true              # Enable automatic detection (default: true)
  # enabled: true               # Optional: explicitly enable/disable
  # namespace: "argocd"         # Custom namespace (default: "argocd")
  # selector: "app.kubernetes.io/name=argocd-server"  # Custom selector
  detectionInterval: 6          # Detection check interval in hours (default: 6)
```
- Maps to `ARGOCD_*` environment variables

### Collection Interval Configuration
```yaml
metrics:
  intervals:
    clusterMetadata: 86400                    # 24 hours (default)
    resourceInventory: 21600                  # 6 hours (default)
    resourceConfigurationPatterns: 43200     # 12 hours (default)
```
- Maps to `*_INTERVAL_SECONDS` environment variables
- Operator enforces minimum intervals to prevent abuse

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
