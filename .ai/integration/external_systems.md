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
- `resourceTreeCapable`: boolean (optional) - Whether resource-tree enrichment is available after a successful lightweight probe (token configured + Argo CD detected). Omitted when Argo CD is not detected.
- `resourceTreeLastError`: object (optional) - Bounded `{ code, message }` for the last **global** demotion reason when `resourceTreeCapable` is false and Argo CD is detected. Cleared/omitted when capable is true.

**Resource-tree HTTP (M17)**:
- `GET /api/v1/applications/{name}/resource-tree` with `appNamespace` query parameter
- On-demand fetch at CLI query time; not persisted to SQLite in M17
- Authenticates with dedicated bearer token (`ARGOCD_API_BEARER_TOKEN` or `ARGOCD_API_TOKEN_FILE`); **no** Kubernetes ServiceAccount token fallback on this path
- HTTP timeout: `ARGOCD_API_TIMEOUT_MS` (default 30000). No operator-side node/byte cap on the response body
- Capability probe: status-loop / detection-adjacent lightweight probe when token is configured and Argo CD is detected; demote only on cluster-wide token/auth/unreachable/RBAC-probe failures (not on per-app not-found/RBAC/timeout)
- Consumer: kube9-vscode via `query argocd resource-tree get`

**Application status (M9, existing)**:
- `GET /api/v1/applications` list collection into SQLite `argocd_apps`
- CLI: `query argocd apps list|get`

## Trivy (optional, M3)

**Scope boundary**: The kube9-operator Helm chart does **not** install, upgrade, or bundle Trivy or the Trivy Operator. Cluster operators (or platform UI that installs other components) may deploy Trivy separately. This integration is **optional**: if Trivy is not present or unreachable, the operator **must not** perform vulnerability scanning and must continue normal operation.

**Behavior**:
- **Detection**: Discover whether an in-cluster Trivy service (API and/or CLI invocation path) is available, using configuration similar in spirit to ArgoCD (env-driven endpoints, timeouts, periodic refresh). Exact discovery rules are implementation-defined but must default to “no Trivy” when nothing is configured or reachable.
- **Scanning**: Run or request scans **only when** Trivy is detected and usable. No background scan loops that assume Trivy exists.
- **Resilience**: Trivy errors, timeouts, or disappearance after detection must be handled gracefully (degraded scan status, structured logging, no crash loops).

**Consumption**: Scan results feed SQLite persistence, security assessment checks, operator CLI query commands, and Prometheus metrics (see `.ai/data/data_model.md` and `.ai/operations/observability.md` as those contracts are extended for M3).

**Boundary vs security-posture collection**: Security-posture collection uses **Kubernetes API aggregates only** (privileged/hostPath/hostNetwork-style counts, NetworkPolicy coverage, basic NSA/CIS-oriented object rollups). It must **not** call Trivy HTTP/CLI, store CVE bodies, or treat Trivy detection as a prerequisite. Trivy remains the vulnerability path; configuration-pattern security-context counts remain a separate collection type.

## Prometheus

Prometheus has two distinct roles for kube9-operator. They must not be conflated in contracts or Helm docs.

### Role A: Operator metrics exposition (inbound scrape)

**Metrics Endpoint**:
- **Path**: `/metrics` on health server (port 8080)
- **Content-Type**: `text/plain; version=0.0.4; charset=utf-8`
- **Format**: Prometheus exposition format

**Metrics Provided**:
- Collection metrics (success/failure rates, duration)
- Event metrics (queue size, storage size, errors)
- Assessment metrics (run counts, durations, results)

**Inbound scrape configuration** (cluster / Prometheus Operator side):
- **Service discovery**: Standard Kubernetes service discovery
- **Scraping**: Configured via Prometheus ServiceMonitor / PodMonitor or annotations (`prometheus.io/scrape: "true"`, `prometheus.io/port: "8080"`)
- kube9-operator does **not** require owning a ServiceMonitor for its own `/metrics` scrape to function

**Health Server**:
- Runs on port 8080 (configurable)
- Provides `/healthz` (liveness), `/readyz` (readiness), and `/metrics` endpoints
- Started early during operator initialization for probe availability

### Role B: Optional outbound client (performance-metrics collector)

**Scope boundary**: The performance-metrics collector may call an **in-cluster Prometheus** PromQL HTTP API to build a **bounded aggregate snapshot** for SQLite `collections`. This path is **optional** and **additive** to Role A. The kube9-operator chart does **not** install Prometheus or Prometheus Operator. Absence or unreachability must not block other collectors, readiness, or serve startup.

**Opt-in posture** (align with Trivy optional outbound):
- No performance-metrics pull until `PROMETHEUS_BASE_URL` / Helm `prometheus.baseUrl` is non-empty (config-gated registration; no separate enable flag).
- Do **not** silently auto-query arbitrary discovered scrapers without configuration. No chart `autoDetect` for Prometheus in v1.
- Default install stays zero-ingress: cluster-internal egress only when configured.
- **Non-goals**: metrics-server / Kubernetes Metrics API fallback; multi-cluster federation; phone-home or upload of collections/metrics to kube9-api; replacing Prometheus Operator as a metrics stack; required `status.prometheus` block.

**Helm / env (packaging + runtime):**
- `prometheus.baseUrl` → `PROMETHEUS_BASE_URL` (emit only when non-empty)
- `prometheus.timeoutMs` (default `30000`, min `1000`) → `PROMETHEUS_TIMEOUT_MS`
- `prometheus.tlsInsecure` (default `false`) → `PROMETHEUS_TLS_INSECURE`

**Behavior**:
- **Call shape (v1):** PromQL HTTP instant queries against the configured base URL (`/api/v1/query` class). Direct target scrape is out of scope for v1.
- **Collection**: On CollectionScheduler ticks for the performance-metrics type, fetch a bounded utilization/ratio rollup snapshot. Persist as an append-only SQLite `collections` row when successful (see `.ai/data/`).
- **Resilience**: Unreachable, auth-failed, timed-out, or empty/unusable Prometheus responses **omit** a `collections` row, count the tick as **failed** on collection metrics / `totalFailureCount`, and retry next interval. Operator global `health` does not become `unhealthy` and `/readyz` stays ready. Do not persist `source.available: false` marker rows.

**Auth family** (v1):
- URL + timeout + TLS only. No bearer, basic, or Secret mount for Prometheus credentials in v1.
- Never send the operator Kubernetes ServiceAccount token as an implicit Prometheus credential.

**Consumption**: Snapshots feed SQLite `collections`, `query collections`, status `collectionStats` participation, and observability `type` labels. kube9-vscode / kube9-desktop are progressive-enhancement consumers later; this initiative is operator-producer only.

### Resolved (Prometheus outbound packaging + client contract)

- Discovery / URL keys, registration gate, auth (none), call shape (PromQL instant), and unavailable degrade (omit + failed) are locked above and in `.ai/runtime/configuration.md` / performance-metrics collector capability.
- Exact PromQL query set / series allowlist and body/size bounds remain the performance-metrics collector implementation detail within the bounded payload catalog.

## In-cluster clients (kube9-vscode and kube9-desktop)

**Consumers**: kube9-vscode and kube9-desktop share the same zero-ingress integration path (ConfigMap read + `kubectl exec` CLI query). Desktop Pro AI agent Tier 2 tools are a co-consumer of `query events list` and `query assessments history` on that path; they do not introduce a separate HTTP or SaaS hop.

**Integration Points**:

1. **Operator detection**:
   - Reads `kube9-operator-status` ConfigMap to determine whether the operator is installed and healthy
   - `basic`: No operator / no status ConfigMap
   - `operated`: Operator installed; clients use status JSON for dashboards, workflows, and (Desktop) capability gating for Tier 2 agent tools

2. **Status monitoring**:
   - Reads ConfigMap for operator health status
   - Uses `status.namespace` to discover operator location
   - Monitors `status.health` for operator health state

3. **Rich Data Queries**:
   - Executes CLI commands via `kubectl exec` for:
     - Event history (`query events list`): vscode, Desktop historical context, and Desktop AI agent Tier 2
     - Assessment results (`query assessments summary`, `query assessments history`): same consumer set for history; agent wraps history for debugging turns
     - Collections (`query collections list|get`): operator-owned; additive types include performance-metrics and security-posture. vscode/desktop consumer UX is progressive enhancement (not same-milestone)
     - Detailed status (`query status`)
   - **Non-goal**: No operator log query surface for these clients. Live logs stay on the Kubernetes API path in the client (Desktop Tier 1).

4. **RBAC Requirements** (unchanged; see [authorization.md](authorization.md)):
   - `get` permission on `configmaps` named `kube9-operator-status` in operator namespace
   - `get` permission on `deployments` in operator namespace (for pod discovery)
   - `create` permission on `pods/exec` in operator namespace (for CLI queries)

5. **Retention narrative for consumers**:
   - Event history available to query is bounded by default severity-split retention (**7** days info/warning, **30** days error/critical). See [api_contracts.md](api_contracts.md) CLI Exec Contract and [`.ai/data/consistency.md`](../data/consistency.md).
   - Assessment history is a **posture / historical check signal** (not live pod logs); no time-based prune commitment for agent consumers; empty/partial results are normal.

**Discovery Flow**:
1. Client checks default namespace (`kube9-system`) for ConfigMap
2. If found, reads `status.namespace` field
3. Uses discovered namespace for all subsequent operations
4. Resolves operator pod via deployment name `kube9-operator`
