# External Systems

## Kubernetes API

**Configuration**:
- **In-cluster mode**: Uses service account token and CA certificate from `/var/run/secrets/kubernetes.io/serviceaccount/`
- **Local development mode**: Falls back to default kubeconfig (`KUBECONFIG` env var or `~/.kube/config`)
- **Auto-detection**: Checks for service account files to determine mode

**API Clients**:
- `CoreV1Api`: Core resources (pods, namespaces, nodes, events, configmaps)
- `AppsV1Api`: Apps resources (deployments, replicasets, statefulsets)
- `VersionApi`: Cluster version information
- `ApiextensionsV1Api`: Custom resource definitions

**Usage**:
- Cluster metadata collection (nodes, namespaces)
- Resource inventory (deployments, services, pods)
- Event watching and recording
- ConfigMap status updates
- ArgoCD detection (CRDs, namespaces, deployments)

## ArgoCD

### Detection Mechanism

**Implementation**: `src/argocd/detection.ts`

**Detection Steps**:
1. **CRD Check**: Verifies `applications.argoproj.io` CustomResourceDefinition exists
   - Uses `ApiextensionsV1Api.getCustomResourceDefinition()`
   - If CRD not found, detection returns `detected: false`
2. **Namespace Check**: Verifies target namespace exists
   - Default namespace: `argocd`
   - Configurable via `ARGOCD_NAMESPACE` environment variable
   - Uses `CoreV1Api.readNamespace()`
3. **Deployment Verification**: Checks for ArgoCD server deployment
   - Default selector: `app.kubernetes.io/name=argocd-server`
   - Configurable via `ARGOCD_SELECTOR` environment variable
   - Uses `AppsV1Api.listNamespacedDeployment()` with label selector
   - Extracts version from deployment image tag or labels

**Configuration Options** (via environment variables):
- `ARGOCD_AUTO_DETECT`: Enable/disable auto-detection (default: `true`, set to `"false"` to disable)
- `ARGOCD_ENABLED`: Explicitly enable/disable ArgoCD integration (overrides `autoDetect`)
  - `"true"`: Skip CRD check, go directly to namespace/deployment check
  - `undefined`: Use auto-detection with CRD check
  - `false`: Disable detection
- `ARGOCD_NAMESPACE`: Custom namespace (default: `"argocd"`)
- `ARGOCD_SELECTOR`: Custom label selector (default: `"app.kubernetes.io/name=argocd-server"`)
- `ARGOCD_DETECTION_INTERVAL`: Detection check interval in hours (default: `6`)

**Periodic Refresh**:
- **Default interval**: 6 hours (`ARGOCD_DETECTION_INTERVAL` environment variable)
- **Manager**: `ArgoCDDetectionManager` (`src/argocd/detection-manager.ts`)
- **Behavior**: Only updates status tracker when detection result changes
- **Timeout protection**: Detection wrapped with 30-second timeout to prevent blocking

**Status Exposure**:
Exposed in ConfigMap `kube9-operator-status` under `status.argocd`:
- `detected`: boolean - Whether ArgoCD is detected
- `namespace`: string | null - Namespace where ArgoCD was detected
- `version`: string | null - ArgoCD version extracted from deployment
- `lastChecked`: string - ISO 8601 timestamp of last detection check

**Future (M9)**:
- Application sync status tracking (HTTP API client and collector — issue #55)
- Drift classification from Application snapshots — issue #56; persistence — issue #57

## Trivy (optional, M3)

**Scope boundary**: The kube9-operator Helm chart does **not** install, upgrade, or bundle Trivy or the Trivy Operator. Cluster operators (or platform UI that installs other components) may deploy Trivy separately. This integration is **optional**: if Trivy is not present or unreachable, the operator **must not** perform vulnerability scanning and must continue normal operation.

**Behavior**:
- **Detection**: Discover whether an in-cluster Trivy service (API and/or CLI invocation path) is available, using configuration similar in spirit to ArgoCD (env-driven endpoints, timeouts, periodic refresh). Exact discovery rules are implementation-defined but must default to “no Trivy” when nothing is configured or reachable.
- **Scanning**: Run or request scans **only when** Trivy is detected and usable. No background scan loops that assume Trivy exists.
- **Resilience**: Trivy errors, timeouts, or disappearance after detection must be handled gracefully (degraded scan status, structured logging, no crash loops).

**Consumption**: Scan results feed SQLite persistence, security assessment checks, operator CLI query commands, and Prometheus metrics (see `.forge/data/data_model.md` and `.forge/operations/observability.md` as those contracts are extended for M3).

## Prometheus

**Metrics Endpoint**:
- **Path**: `/metrics` on health server (port 8080)
- **Content-Type**: `text/plain; version=0.0.4; charset=utf-8`
- **Format**: Prometheus exposition format

**Metrics Provided**:
- Collection metrics (success/failure rates, duration)
- Event metrics (queue size, storage size, errors)
- Assessment metrics (run counts, durations, results)

**Configuration**:
- **Endpoint override**: Planned for M1 milestone (not yet implemented)
- **Auto-detection**: Default behavior (scrapes from `/metrics` endpoint)
- **Service discovery**: Uses standard Kubernetes service discovery
- **Scraping**: Configured via Prometheus ServiceMonitor or annotations (`prometheus.io/scrape: "true"`, `prometheus.io/port: "8080"`)

**Health Server**:
- Runs on port 8080 (configurable)
- Provides `/healthz` (liveness), `/readyz` (readiness), and `/metrics` endpoints
- Started early during operator initialization for probe availability

## kube9-vscode

**Primary Consumer**: VS Code extension that integrates with kube9-operator

**Integration Points**:

1. **Operator detection**:
   - Reads `kube9-operator-status` ConfigMap to determine whether the operator is installed and healthy
   - `basic`: No operator / no status ConfigMap
   - `operated`: Operator installed; extension uses status JSON for dashboards and workflows

2. **Status monitoring**:
   - Reads ConfigMap for operator health status
   - Uses `status.namespace` to discover operator location
   - Monitors `status.health` for operator health state

3. **Rich Data Queries**:
   - Executes CLI commands via `kubectl exec` for:
     - Event history (`query events list`)
     - Assessment results (`query assessments summary`, `query assessments history`)
     - Detailed status (`query status`)

4. **RBAC Requirements**:
   - `get` permission on `configmaps` named `kube9-operator-status` in operator namespace
   - `get` permission on `deployments` in operator namespace (for pod discovery)
   - `create` permission on `pods/exec` in operator namespace (for CLI queries)

**Discovery Flow**:
1. Extension checks default namespace (`kube9-system`) for ConfigMap
2. If found, reads `status.namespace` field
3. Uses discovered namespace for all subsequent operations
4. Resolves operator pod via deployment name `kube9-operator`
