# Accessibility

## RBAC for Extension Users
Extension users require the following RBAC permissions to interact with the operator:

### ConfigMap Access
- **Resource**: `configmaps`
- **Name**: `kube9-operator-status`
- **Namespace**: Operator namespace (typically `kube9-system`)
- **Verb**: `get`
- **Purpose**: Read operator status from ConfigMap

### CLI Execution Access
- **Resource**: `pods/exec`
- **Namespace**: Operator namespace
- **Verb**: `create`
- **Purpose**: Execute CLI commands in operator pod via `kubectl exec`

### Pod Resolution Access
- **Resource**: `deployments`
- **Namespace**: Operator namespace
- **Verb**: `get`
- **Purpose**: Resolve operator pod name from deployment selector

### Example Role for Extension Users
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-query
  namespace: kube9-system
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["kube9-operator-status"]
  verbs: ["get"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  resourceNames: ["kube9-operator"]
  verbs: ["get"]
```

## Operator RBAC
The operator requires the following RBAC permissions:

### Cluster-Level Permissions (ClusterRole)
- **Read-only cluster metadata**: 
  - Non-resource URLs: `/version` (get)
  - Resources: `nodes`, `namespaces`, `pods`, `events` (get, list, watch)
  - Resources: `deployments`, `replicasets`, `statefulsets`, `services` (get, list, watch)
  - Resources: `customresourcedefinitions` (get, list)
- **Purpose**: Data collection, cluster metadata, resource inventory, event monitoring, ArgoCD detection

### Namespace-Level Permissions (Role)
- **ConfigMap management**:
  - Resource: `configmaps`
  - Namespace: Operator namespace
  - Verbs: `get`, `create`, `update`, `patch`
  - Purpose: Create and update status ConfigMap

### Security Principles
- **Minimal permissions**: Operator only requests necessary read-only cluster access
- **No arbitrary writes**: Operator only writes to its own status ConfigMap
- **No secrets access**: Operator does not read or write secrets (except in Pro tier for registration)
- **Namespace-scoped writes**: All write operations are scoped to operator namespace
