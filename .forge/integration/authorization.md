# Authorization

## Kubernetes RBAC

### Operator RBAC (ClusterRole)

**Resource**: `ClusterRole` (created when `rbac.create: true` in Helm values)

**Permissions Required**:

**Cluster Metadata**:
- `get` on non-resource URL `/version` (cluster version)

**Core Resources** (read-only):
- `get`, `list`, `watch` on:
  - `nodes` - For cluster metadata collection
  - `namespaces` - For resource inventory and ArgoCD detection
  - `pods` - For resource inventory
  - `events` - For Kubernetes event watching and recording
  - `services` - For resource inventory

**Apps Resources** (read-only):
- `get`, `list`, `watch` on:
  - `deployments` - For resource inventory and ArgoCD detection
  - `replicasets` - For resource inventory
  - `statefulsets` - For resource inventory

**ArgoCD Detection**:
- `get`, `list` on:
  - `customresourcedefinitions` (apiextensions.k8s.io) - To check for `applications.argoproj.io` CRD
  - `namespaces` - To verify ArgoCD namespace exists
  - `deployments` (apps) - To find ArgoCD server deployment

**Binding**: `ClusterRoleBinding` binds ServiceAccount to ClusterRole

### Operator RBAC (Role - Namespace-scoped)

**Resource**: `Role` in operator namespace (always created)

**Permissions Required**:

**Status ConfigMap Management**:
- `get`, `create`, `update`, `patch` on:
  - `configmaps` - To manage `kube9-operator-status` ConfigMap

**Binding**: `RoleBinding` binds ServiceAccount to Role in operator namespace

### Extension User RBAC

**Required Permissions**:

**ConfigMap Read**:
- `get` on `configmaps` named `kube9-operator-status` in operator namespace
- Used for tier detection and status monitoring

**Pod Discovery**:
- `get` on `deployments` in operator namespace
- Used to resolve operator pod name for `kubectl exec` commands

**CLI Exec**:
- `create` on `pods/exec` subresource in operator namespace
- Required for executing `kubectl exec` commands into operator pod
- Format: `kubectl exec -n <namespace> deploy/kube9-operator -- kube9-operator query <command>`

**Example RoleBinding** (for extension users):
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
- Kubernetes API: Operator-initiated API calls
- Prometheus: Metrics endpoint exposed, scraped by Prometheus (no ingress needed)
- ArgoCD: Detection via Kubernetes API (no direct ArgoCD API calls)

**Extension → Operator** (via kubectl):
- ConfigMap read: Direct Kubernetes API access (no ingress)
- CLI exec: Direct `kubectl exec` into pod (no ingress)
- All communication uses standard Kubernetes mechanisms

**No External Server Communication** (Free Tier):
- Free tier operator makes no outbound connections
- All data stays within cluster
- Status exposed via ConfigMap only

**Pro Tier** (Future):
- Outbound HTTPS connections to `kube9-server` (API)
- Operator-initiated only (no ingress)
- Uses standard egress policies

**Benefits**:
- No ingress controller required
- No external IPs or load balancers needed
- Works in air-gapped environments (free tier)
- Simplified network security (egress-only)
