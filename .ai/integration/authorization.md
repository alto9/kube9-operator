# Authorization

## Kubernetes RBAC

### Operator RBAC (ClusterRole)

**Resource**: `ClusterRole` (created when `rbac.create: true` in Helm values)

**Permissions Required** (read-only cluster access; chart `ClusterRole` is authoritative when `rbac.create: true`):

**Cluster Metadata**:
- `get` on non-resource URL `/version` (cluster version)

**Core Resources** (read-only):
- `get`, `list`, `watch` on:
  - `nodes` - Cluster metadata collection
  - `namespaces` - Resource inventory, ArgoCD detection, posture coverage denominators
  - `pods` - Resource inventory and security-posture aggregates (privileged / hostPath / hostNetwork-style signals)
  - `events` - Kubernetes event watching and recording
  - `services` - Resource inventory
  - `configmaps` - Cluster-scoped reads used by collectors/assessments (status ConfigMap writes remain Role-scoped)
  - `resourcequotas`, `limitranges` - Assessment / governance signals

**Apps Resources** (read-only):
- `get`, `list`, `watch` on:
  - `deployments`, `replicasets`, `statefulsets`, `daemonsets` - Inventory, ArgoCD detection, assessment

**Networking / policy** (read-only):
- `get`, `list`, `watch` on:
  - `networkpolicies` (networking.k8s.io) - Security-posture NetworkPolicy coverage and related conformance/assessment checks
  - `poddisruptionbudgets` (policy) - Assessment
  - `horizontalpodautoscalers` (autoscaling) - Assessment
  - `verticalpodautoscalers` (autoscaling.k8s.io) - Optional when CRD present

**RBAC resources** (read-only; assessment analysis today):
- `get`, `list` on `clusterroles`, `roles`, `clusterrolebindings`, `rolebindings` (rbac.authorization.k8s.io)
- **Note:** Security-posture **v1** does **not** publish RBAC-risk rollups. These reads remain for assessment checks; posture v1 must not expand into RBAC-risk product scope via this initiative.

**ArgoCD Detection**:
- `get`, `list` on:
  - `customresourcedefinitions` (apiextensions.k8s.io) - To check for `applications.argoproj.io` CRD
  - `namespaces` - To verify ArgoCD namespace exists
  - `deployments` (apps) - To find ArgoCD server deployment

**Security-posture collector**: Uses the same read-only Kubernetes API surface (pods, namespaces, networkpolicies, and related object fields already readable). No Secrets API, no `pods/exec`, no cluster-admin. Any additional API-group reads required for agreed NSA/CIS-oriented rollups are additive ClusterRole deltas coordinated with operations (open implementation decision below).

**Prometheus outbound client**: Optional HTTP egress to a configured in-cluster Prometheus. Does **not** require new Kubernetes RBAC verbs for Prometheus itself. Credential mounts (if any) follow optional Secret patterns; do not imply SA token as Prometheus credential by default (see [external_systems.md](external_systems.md)).

**Binding**: `ClusterRoleBinding` binds ServiceAccount to ClusterRole

### Operator RBAC (Role - Namespace-scoped)

**Resource**: `Role` in operator namespace (always created)

**Permissions Required**:

**Status ConfigMap Management**:
- `get`, `create`, `update`, `patch` on:
  - `configmaps` - To manage `kube9-operator-status` ConfigMap

**Binding**: `RoleBinding` binds ServiceAccount to Role in operator namespace

### Extension / Desktop User RBAC

**Applies to**: kube9-vscode extension users and kube9-desktop (including Desktop Pro AI agent Tier 2 operator queries). Same permission set; no separate agent auth model.

**Required Permissions**:

**ConfigMap Read**:
- `get` on `configmaps` named `kube9-operator-status` in operator namespace
- Used for operator presence detection and status monitoring

**Pod Discovery**:
- `get` on `deployments` in operator namespace
- Used to resolve operator pod name for `kubectl exec` commands

**CLI Exec**:
- `create` on `pods/exec` subresource in operator namespace
- Required for executing `kubectl exec` commands into operator pod
- Format: `kubectl exec -n <namespace> deploy/kube9-operator -- kube9-operator query <command>`
- Agent-facing history uses the same exec path (`query events list`, `query assessments history`); auth is unchanged for agent debugging tools

**Example RoleBinding** (for extension / Desktop users):
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-extension-reader
  namespace: kube9-system
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["kube9-operator-status"]
  verbs: ["get"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  resourceNames: ["kube9-operator"]
  verbs: ["get"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
```

### Security Model

**Read-Only Cluster Access**:
- Operator never modifies cluster resources (except its own ConfigMap)
- All cluster resource access is read-only
- No write permissions to arbitrary resources

**Minimal Permissions**:
- Operator follows principle of least privilege
- Only requests permissions necessary for functionality
- RBAC resources can be reviewed before installation

**Service Account**:
- Operator runs with dedicated ServiceAccount (default: `kube9-operator`)
- ServiceAccount can be created by Helm chart or provided externally
- Non-root execution (UID 1000)

## Zero Ingress Architecture

**Design Principle**: No ingress required for operator functionality

**Communication Patterns**:

**Operator → In-Cluster Services** (outbound only):
- Kubernetes API: Operator-initiated API calls (includes security-posture aggregates; sole posture source)
- Prometheus **exposition**: Operator `/metrics` exposed on the health server; scraped by in-cluster Prometheus / agents (no ingress needed). kube9 does not require owning the scraper.
- Prometheus **outbound client** (optional, performance-metrics collector): Operator-initiated HTTP to a configured in-cluster Prometheus endpoint (query and/or scrape). Trivy-style opt-in; graceful degrade when absent/unreachable. No metrics-server / Metrics API path. No phone-home.
- Argo CD: Detection uses the Kubernetes API (`src/argocd/detection.ts`). **M9** adds read-only HTTP to in-cluster `argocd-server` for Application list/status into SQLite. **M17** adds on-demand `GET /api/v1/applications/{name}/resource-tree` at CLI query time. All Argo CD HTTP is **zero ingress** (cluster-internal egress).
- **M17 resource-tree auth:** Dedicated Argo CD API bearer only (`ARGOCD_API_BEARER_TOKEN` or `ARGOCD_API_TOKEN_FILE`). The resource-tree path **must not** fall back to the operator Kubernetes ServiceAccount token. Platform admin creates a Secret out-of-band and sets Helm `argocd.api.token.existingSecret` / `existingSecretKey` (default key `token`); the chart mounts the key at `/var/run/secrets/kube9/argocd-api-token` and sets `ARGOCD_API_TOKEN_FILE`. Unset `existingSecret` is default-off. Platform admin grants Argo CD RBAC `get` on Applications (resource-tree) for the token identity; the kube9-operator chart does not mutate Argo CD roles.

**Extension / Desktop → Operator** (via kubectl):
- ConfigMap read: Direct Kubernetes API access (no ingress)
- CLI exec: Direct `kubectl exec` into pod (no ingress), including Desktop AI agent Tier 2 history queries
- All communication uses standard Kubernetes mechanisms
- No agent-specific ingress, token exchange, or hosted SaaS path for operator history

**Outbound connections (operator core)**:
- Kubernetes API (in-cluster or via kubeconfig)
- Optional Trivy HTTP health/version probes when `TRIVY_SERVER_URL` / chart `trivy.serverUrl` is set
- Optional Prometheus HTTP client when performance-metrics outbound is configured (base URL / enable knobs; see [external_systems.md](external_systems.md))
- The operator does not register with or upload collections to `kube9-api`

**Benefits**:
- No ingress controller required
- No external IPs or load balancers needed
- Works in air-gapped environments (open-source operator path)
- Simplified network security (egress-only)

## Open implementation decisions

- **Agent auth model**: Closed for this epic. Desktop AI agent Tier 2 uses the same Extension / Desktop User RBAC and kubectl-exec path; no new Role, ClusterRole, or token type.
- **Prometheus outbound auth knobs**: Exact none / bearer / basic / Secret-mount defaults and TLS verify vs insecure. Confirm operator SA token is never an implicit Prometheus credential. Align Secret mount patterns with chart precedents if dedicated credentials are supported. Peer scope `#169` / `#171`.

### Resolved (security-posture RBAC and health)

- **RBAC delta:** None for the locked v1 posture signal set (pods, apps workloads, namespaces, networkpolicies already granted). Keep read-only; no Secrets, no pod exec, no cluster-admin.
- **Degrade vs global health:** Posture API list failures follow omit-row + failed metrics + retry next interval. Do not widen `health: degraded` / `unhealthy` or fail `/readyz` solely for posture collect failures (coordinate with runtime/error_handling).
