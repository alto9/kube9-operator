# Security

## Zero Ingress Architecture

### Network Security Model
- **No Ingress Required**: Operator does not expose any ingress resources
- **All Communication Outbound**: All network traffic is outbound to in-cluster services
- **No External Exposure**: Operator never receives inbound connections from outside the cluster
- **In-Cluster Only**: Communication limited to:
  - Kubernetes API server
  - Prometheus (if available)
  - ArgoCD (if available)
  - Other in-cluster services

### Security Benefits
- Reduces attack surface (no ingress = no external attack vector)
- Follows principle of least privilege for network access
- No need for ingress controllers or TLS termination
- Simplifies network policies

## Minimal RBAC

### ClusterRole Permissions

The operator requires minimal cluster-wide permissions via ClusterRole:

#### Read-Only Cluster Resources
- **`/version`** (non-resource URL): `get` - Read cluster version for metadata collection
- **`nodes`**: `get`, `list`, `watch` - Cluster metadata collection
- **`namespaces`**: `get`, `list`, `watch` - Cluster metadata and ArgoCD detection
- **`pods`**: `get`, `list`, `watch` - Cluster metadata collection
- **`events`**: `get`, `list`, `watch` - Event monitoring and recording

#### Read-Only Workload Resources
- **`deployments`** (apps): `get`, `list`, `watch` - Resource inventory and ArgoCD detection
- **`replicasets`** (apps): `get`, `list`, `watch` - Resource inventory
- **`statefulsets`** (apps): `get`, `list`, `watch` - Resource inventory
- **`services`**: `get`, `list`, `watch` - Resource inventory

#### ArgoCD Detection Permissions
- **`customresourcedefinitions`** (apiextensions.k8s.io): `get`, `list` - ArgoCD CRD detection
- **`namespaces`**: `get` - ArgoCD namespace detection
- **`deployments`** (apps): `get`, `list` - ArgoCD server detection

### Namespace Role Permissions

The operator requires namespace-scoped permissions via Role:

#### ConfigMap Management
- **`configmaps`**: `get`, `create`, `update`, `patch`
  - **Purpose**: Manage status ConfigMap (`kube9-operator-status`)
  - **Scope**: Limited to operator's namespace only
  - **Usage**: 
    - Create/update status ConfigMap for VS Code extension integration
    - Health check test ConfigMap (`kube9-operator-health-check`)

### RBAC Security Principles
- **Read-Only by Default**: All cluster resources are read-only
- **Minimal Write Access**: Only ConfigMap write access in operator's namespace
- **No Secrets Access**: Operator never requests secrets or credentials
- **No Pod Execution**: Operator does not execute commands in other pods
- **No Cluster Admin**: No cluster-admin or elevated privileges required

### Service Account
- **Name**: `kube9-operator` (configurable)
- **Creation**: Automatically created by Helm chart (configurable)
- **Binding**: ClusterRoleBinding and RoleBinding created automatically

## Non-Root Execution

### Container Security Context

#### Pod-Level Security Context
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
```

#### Container-Level Security Context
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
```


- **`allowPrivilegeEscalation`**: `false` - Prevents privilege escalation
- **`capabilities.drop`**: `ALL` - Drops all Linux capabilities

### Docker Image Security

#### User Configuration
- **Base Image**: `node:22-alpine` (Alpine Linux with Node.js 22)
- **Runtime User**: `node` user (UID 1000)
- **User Creation**: Uses existing `node` user from base image
- **Data Directory**: `/data` owned by `node:node` (UID 1000, GID 1000)

#### Build Process Security
- Multi-stage build reduces attack surface
- Production stage removes build dependencies.
- Minimal base image (Alpine Linux).
- No unnecessary packages or tools in final image.

### Filesystem Security

#### Read-Only Considerations
- **Data Directory**: `/data` mounted as PersistentVolume (read-write required for SQLite)
- **Application Directory**: `/app` contains application code (read-only in practice)
- **Temporary Files**: No temporary file writes required
- **Logs**: Written to stdout (no filesystem writes)

#### Volume Mounts
- **`/data`**: PersistentVolumeClaim for SQLite database
  - Required for data persistence.
  - Read-write access necessary for database operations.
  - Isolated to operator's data only.

### Security Context Enforcement
- **Kubernetes Enforcement**: Security contexts enforced by Kubernetes.
- **Container Runtime**: Container runtime enforces non-root execution.
- **Image Compliance**: Dockerfile ensures non-root user.
- **Helm Chart**: Deployment template enforces security contexts.

## Security Best Practices Summary

1. **Zero Ingress**: No external attack surface
2. **Minimal RBAC**: Read-only cluster access, write only to namespace ConfigMaps
3. **Non-Root Execution**: Runs as UID 1000, no privilege escalation
4. **Capability Dropping**: All Linux capabilities dropped
5. **No Secrets Access**: Never requests or accesses secrets
6. **Isolated Data**: Database isolated to operator's namespace
7. **Structured Logging**: No sensitive data in logs
8. **Minimal Image**: Alpine-based, minimal dependencies
