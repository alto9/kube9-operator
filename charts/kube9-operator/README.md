# kube9-operator Helm Chart

This Helm chart installs the kube9-operator, a Kubernetes operator that powers Well-Architected Framework validation and in-cluster status for the [kube9 VS Code extension](https://github.com/alto9/kube9-vscode) and other tooling. It also supports optional integrations (for example ArgoCD awareness and Trivy server detection) configured through values.

Assessment walkthroughs and CLI examples are documented in the repository guide: [`docs/assessment/user-guide.md`](../../docs/assessment/user-guide.md).

## Overview

The kube9-operator runs in your Kubernetes cluster and publishes status and assessment-related data locally. The VS Code extension uses this to determine whether your cluster is in:

- **Basic mode** (no operator) — kubectl-focused workflows
- **Operated mode** (operator installed) — scheduled assessments, local persistence, and ConfigMap status for the extension
- **Enabled mode** — richer server-connected experiences when registration succeeds (not configured through Helm API key values in this chart)

The operator is installed via Helm and requires no ingress for the control plane path this chart installs. The chart does not configure API keys, credentials, or remote product sign-in.

### What This Chart Installs

- **Deployment**: The kube9-operator pod running in your cluster
- **ServiceAccount**: Service account for the operator (if `serviceAccount.create` is true)
- **RBAC Resources**: ClusterRole and ClusterRoleBinding for necessary permissions (if `rbac.create` is true)
- **ConfigMap**: Status ConfigMap written by the operator (created automatically by the operator)

## Prerequisites

- Kubernetes cluster version 1.24.0 or higher
- `kubectl` configured with cluster access and appropriate permissions
- Helm 3.x installed
- Cluster administrator permissions (for initial installation)

## Installation

### Add the Helm Repository

```bash
helm repo add kube9 https://charts.kube9.io
helm repo update
```

### Install the Operator

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

After installation, the operator will:
- Start in "operated" (free tier) mode
- Create a status ConfigMap for the VS Code extension to read
- Provide basic cluster status information

### Verify Installation

```bash
# Check operator pod status
kubectl get pods -n kube9-system

# View operator logs
kubectl logs -n kube9-system deployment/kube9-operator

# Check status ConfigMap
kubectl get configmap kube9-operator-status -n kube9-system -o yaml
```

### Prometheus metrics (`/metrics`)

The operator serves Prometheus text exposition on **`http://<pod-ip>:8080/metrics`** on the same port as `/healthz` and `/readyz`. There is no dedicated `Service` in this chart by default; scrape the pod port directly (for example via a `Service`/`ServiceMonitor` you manage, or via the classic pod annotation pattern).

**Optional scrape annotations** — set `podAnnotations` so agents that honor `prometheus.io/*` can discover the target, for example:

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: "/metrics"
```

**Validate assessment metrics** — after the operator has run at least one in-cluster assessment (operated mode), confirm counters move (from your workstation, with `curl` available):

```bash
kubectl port-forward -n kube9-system deploy/kube9-operator 8080:8080
# In another terminal:
curl -s http://127.0.0.1:8080/metrics | grep kube9_operator_assessment_
```

You should see series such as `kube9_operator_assessment_runs_total`, `kube9_operator_assessment_checks_total`, and gauges/histograms named with the `kube9_operator_assessment_` prefix. Full definitions and label cardinality notes live in `.forge/operations/observability.md` in the application repository.

## Configuration

The following table lists the configurable parameters and their default values:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podAnnotations` | Optional annotations on the operator pod (for example `prometheus.io/scrape`) | `{}` |
| `image.repository` | Container image repository | `ghcr.io/alto9/kube9-operator` |
| `image.tag` | Container image tag | `"1.3.0"` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `resources.requests.memory` | Memory request for operator pod | `"1Gi"` |
| `resources.requests.cpu` | CPU request for operator pod | `"500m"` |
| `resources.limits.memory` | Memory limit for operator pod | `"1Gi"` |
| `resources.limits.cpu` | CPU limit for operator pod | `"500m"` |
| `serviceAccount.create` | Create a service account for the operator | `true` |
| `serviceAccount.name` | Name of the service account to create or use | `"kube9-operator"` |
| `rbac.create` | Create RBAC resources (ClusterRole and ClusterRoleBinding) | `true` |
| `logLevel` | Log level for the operator. Options: `debug`, `info`, `warn`, `error` | `"info"` |
| `statusUpdateIntervalSeconds` | How often the operator updates the status ConfigMap (in seconds) | `60` |
| `metrics.intervals.clusterMetadata` | Cluster metadata collection interval (seconds). Default 86400 (24h), minimum 3600 (1h) | `86400` |
| `metrics.intervals.resourceInventory` | Resource inventory collection interval (seconds). Default 21600 (6h), minimum 1800 (30m) | `21600` |
| `metrics.intervals.resourceConfigurationPatterns` | Resource configuration patterns collection interval (seconds). Default 43200 (12h), minimum 3600 (1h) | `43200` |
| `events.persistence.enabled` | Enable PersistentVolume for event storage. When false, uses emptyDir (data lost on pod restart) | `true` |
| `events.persistence.size` | PVC size for event database | `5Gi` |
| `events.persistence.storageClassName` | Storage class for PVC. Empty uses cluster default | `""` |
| `events.persistence.accessMode` | PVC access mode | `ReadWriteOnce` |
| `events.retention.infoWarning` | Days to retain info/warning events | `7` |
| `events.retention.errorCritical` | Days to retain error/critical events | `30` |
| `argocd.autoDetect` | Enable automatic ArgoCD detection | `true` |
| `argocd.enabled` | Explicitly enable or disable ArgoCD integration (optional; bypasses CRD check when set) | - |
| `argocd.namespace` | Custom namespace where ArgoCD is installed | `"argocd"` |
| `argocd.selector` | Custom label selector for ArgoCD server deployment | `app.kubernetes.io/name=argocd-server` |
| `argocd.detectionInterval` | Detection check interval in hours (valid range: 1–24) | `6` |
| `trivy.autoDetect` | Probe `trivy.serverUrl` periodically for Trivy HTTP health | `true` |
| `trivy.serverUrl` | Trivy server base URL (required for detection and scans) | (unset) |
| `trivy.healthPath` | Health probe path (e.g. `/healthz`) | `"/healthz"` |
| `trivy.detectionInterval` | Hours between Trivy re-detection attempts | `6` |
| `trivy.detectionTimeoutMs` | Timeout for each Trivy health probe | `10000` |
| `trivy.scanTimeoutMs` | `TRIVY_SCAN_TIMEOUT_MS` — per-image Trivy CLI scan timeout | `600000` |
| `trivy.maxScansPerCycle` | Max distinct images scanned per workload cycle (sorted unique refs) | `100` |
| `trivy.vulnMaxCritical` | `VULN_MAX_CRITICAL` — stored critical findings allowed (default `0` fails on any critical) | `0` |
| `trivy.vulnMaxHigh` | `VULN_MAX_HIGH` | `1000000` |
| `trivy.vulnMaxMedium` | `VULN_MAX_MEDIUM` | `1000000` |
| `metrics.intervals.workloadImageScan` | Seconds between workload image collection / scan cycles | `86400` |

### Configuration Details

#### Image Configuration (`image.*`)

- **repository**: The container image repository. Default points to the official kube9-operator image.
- **tag**: The image tag/version to deploy. Defaults to chart version.
- **pullPolicy**: When to pull the image. `IfNotPresent` (default) pulls only if not already present, `Always` always pulls.

#### Resource Limits (`resources.*`)

The operator uses Guaranteed QoS for stable performance:
- **Default requests**: 500m CPU, 1Gi memory
- **Default limits**: 500m CPU, 1Gi memory (same as requests for Guaranteed QoS)
- 1Gi memory needed to handle CLI exec spawning separate Node.js processes
- Adjust based on your cluster's resource constraints and workload

#### Service Account (`serviceAccount.*`)

- **create**: Set to `true` (default) to create a new service account, or `false` to use an existing one
- **name**: Name of the service account. If `create` is true, this name will be used. If `create` is false, this must reference an existing service account.

#### RBAC (`rbac.create`)

- Set to `true` (default) to create ClusterRole and ClusterRoleBinding
- Set to `false` if you want to manage RBAC resources separately
- The operator needs permissions to:
  - Read cluster metadata (for future metrics)
  - Create/update ConfigMaps in the kube9-system namespace

#### Logging (`logLevel`)

- **debug**: Verbose logging for troubleshooting
- **info**: Standard informational logging (default)
- **warn**: Only warnings and errors
- **error**: Only errors

#### Status interval

- **statusUpdateIntervalSeconds**: How frequently the operator writes status to the ConfigMap (default: 60 seconds). Lower values provide more real-time status but increase API calls; higher values reduce API load but status may be slightly stale.

#### Metrics Collection Intervals (`metrics.intervals`)

Controls how often the operator collects different types of metrics data. All values are in **seconds**. The operator enforces minimum intervals to prevent excessive API usage and cluster load.

| Interval | Default | Minimum | Human-readable |
|----------|---------|---------|----------------|
| `clusterMetadata` | 86400 | 3600 | 24h / 1h |
| `resourceInventory` | 21600 | 1800 | 6h / 30m |
| `resourceConfigurationPatterns` | 43200 | 3600 | 12h / 1h |

**Usage scenarios:**

- **Production**: Use defaults. Balances freshness with API load and cluster impact.
- **Testing/debugging**: Override with shorter intervals within the minimums to get faster feedback during development or troubleshooting.

#### Event Storage and Retention (`events.*`)

The operator stores Kubernetes events in a SQLite database for insights and dashboards. You can configure persistence and retention policies.

**Persistence (`events.persistence`):**

- **enabled** (default: `true`): When `true`, uses a PersistentVolumeClaim (PVC) so event data survives pod restarts. When `false`, uses `emptyDir`—data is lost when the pod restarts.
- **size** (default: `5Gi`): Volume size for the event database.
- **storageClassName** (default: `""`): Storage class for the PVC. Empty string uses the cluster default.
- **accessMode**: `ReadWriteOnce` (single node read/write).

**Retention (`events.retention`):**

- **infoWarning** (default: `7`): Days to retain info and warning events.
- **errorCritical** (default: `30`): Days to retain error and critical events.

**PVC vs emptyDir behavior:**

- **Persistence enabled**: A PVC is created; event data persists across pod restarts and upgrades.
- **Persistence disabled**: Uses `emptyDir`; no PVC is created. Suitable for ephemeral or low-resource clusters where event history is not required.

**Usage scenarios:**

| Scenario | Persistence | Size | Retention (infoWarning / errorCritical) | Use case |
|----------|-------------|------|----------------------------------------|----------|
| High-event cluster | `true` | `10Gi` or more | `14` / `60` | Busy clusters needing longer history |
| Low-resource cluster | `false` | N/A | `3` / `7` | Ephemeral or resource-constrained clusters |
| Default | `true` | `5Gi` | `7` / `30` | General production use |

#### ArgoCD Configuration (`argocd.*`)

The operator can detect and integrate with ArgoCD installations in your cluster. Use these settings when ArgoCD is in a non-standard namespace or you need custom detection behavior.

- **autoDetect** (default: `true`): When enabled, the operator periodically detects ArgoCD by checking for the ArgoCD CRD and server deployment. Disable to turn off ArgoCD integration entirely.
- **enabled** (optional): Explicitly enable or disable ArgoCD integration. When set, bypasses the CRD check—use when ArgoCD is installed but the CRD is not present or detection fails. Leave unset to use autoDetect behavior.
- **namespace** (default: `"argocd"`): The namespace where ArgoCD is installed. Override when using a custom namespace (e.g. `gitops`).
- **selector** (default: `app.kubernetes.io/name=argocd-server`): Kubernetes label selector used to find the ArgoCD server deployment. Override only if your ArgoCD uses different labels.
- **detectionInterval** (default: `6`): How often the operator re-checks for ArgoCD installation changes, in hours. Valid range: 1–24 hours.

**When to use `enabled` vs `autoDetect`:**

- **autoDetect only (default)**: Operator checks for ArgoCD CRD and server deployment. Best for standard ArgoCD installs.
- **enabled: true**: Bypasses CRD check; directly checks the namespace for the server deployment. Use when ArgoCD is installed without the CRD or auto-detection fails.
- **autoDetect: false**: Disables ArgoCD integration. Use when you do not want the operator to detect or report ArgoCD status.

**Usage scenarios:**

| Scenario | Configuration | Use case |
|----------|---------------|----------|
| Default auto-detect | `autoDetect: true` (default) | Standard ArgoCD in `argocd` namespace |
| Custom namespace | `namespace: "gitops"` | ArgoCD installed in `gitops` or other namespace |
| Explicit enable | `enabled: true`, `namespace: "argocd"` | ArgoCD without CRD; bypass CRD check |
| Disable ArgoCD | `autoDetect: false` | No ArgoCD integration desired |

## Examples

### Custom Image Tag

Deploy a specific image version:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --set image.tag=1.3.0
```

### Resource Tuning

Create a `custom-values.yaml` file to adjust resource limits:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "400m"
```

Install with custom values:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --values custom-values.yaml
```

### Debug Logging

Enable verbose logging for troubleshooting:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --set logLevel=debug
```

### Combined Custom Values

Create a `custom-values.yaml` file with multiple overrides:

```yaml
# Custom resource limits
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "400m"

# Debug logging
logLevel: debug

# More frequent status updates
statusUpdateIntervalSeconds: 30

# Custom image tag
image:
  tag: "1.3.0"
```

### Testing/Debugging: Shorter Collection Intervals

For faster feedback during development or troubleshooting, override metrics intervals with values at or above the minimums:

```yaml
metrics:
  intervals:
    clusterMetadata: 3600          # 1h (minimum)
    resourceInventory: 1800       # 30m (minimum)
    resourceConfigurationPatterns: 3600  # 1h (minimum)
```

Install with custom values:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --values custom-values.yaml
```

### High-Event Cluster (Larger Size, Longer Retention)

For clusters with high event volume that need extended history:

```yaml
events:
  persistence:
    enabled: true
    size: 10Gi
    storageClassName: ""  # or specify e.g. "fast-ssd"
  retention:
    infoWarning: 14   # 2 weeks
    errorCritical: 60  # 2 months
```

### Low-Resource Cluster (Ephemeral Storage, Shorter Retention)

For resource-constrained or ephemeral clusters where event history is not critical:

```yaml
events:
  persistence:
    enabled: false  # Uses emptyDir; no PVC
  retention:
    infoWarning: 3
    errorCritical: 7
```

### ArgoCD Configuration Examples

**Default auto-detect** (recommended for standard ArgoCD installs):

```yaml
argocd:
  autoDetect: true  # default
```

**Custom namespace** (e.g. ArgoCD in `gitops`):

```yaml
argocd:
  autoDetect: true
  namespace: "gitops"
```

**Explicit enable** (ArgoCD without CRD; bypasses CRD check):

```yaml
argocd:
  enabled: true
  namespace: "argocd"
```

**Disable ArgoCD integration**:

```yaml
argocd:
  autoDetect: false
```

**Custom detection interval** (check every 12 hours instead of default 6):

```yaml
argocd:
  autoDetect: true
  detectionInterval: 12  # valid range: 1–24 hours
```

Install with ArgoCD overrides:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --set argocd.namespace=gitops \
  --set argocd.detectionInterval=12
```

### Upgrade to New Version

To upgrade to a newer version of the operator:

```bash
# Update Helm repository
helm repo update

# Upgrade the release
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system
```

Existing configuration will be preserved.

### Uninstall

To remove the operator and all associated resources:

```bash
helm uninstall kube9-operator --namespace kube9-system
```

This removes:
- The operator Deployment
- ServiceAccount (if created by the chart)
- RBAC resources (ClusterRole and ClusterRoleBinding, if created by the chart)

**Note**: The status ConfigMap created by the operator will remain. You can manually delete it if desired:

```bash
kubectl delete configmap kube9-operator-status -n kube9-system
```

## Troubleshooting

### Operator Pod Not Starting

**Symptoms**: Pod shows `CrashLoopBackOff` or `Error` status

**Diagnosis**:

```bash
# Check pod status
kubectl get pods -n kube9-system

# View pod events
kubectl describe pod -n kube9-system -l app.kubernetes.io/name=kube9-operator

# Check logs
kubectl logs -n kube9-system deployment/kube9-operator
```

**Common Causes**:
- Image pull errors: Check image repository and tag
- Resource constraints: Verify cluster has available resources
- RBAC issues: Ensure ClusterRole and ClusterRoleBinding are created
- Invalid configuration: Check values.yaml for syntax errors

**Solutions**:
- Verify image exists: `docker pull ghcr.io/alto9/kube9-operator:1.3.0`
- Check resource availability: `kubectl top nodes`
- Review RBAC: `kubectl get clusterrole,clusterrolebinding | grep kube9-operator`
- Validate Helm values: `helm template kube9-operator . --debug`

### Status ConfigMap Not Created

**Symptoms**: ConfigMap `kube9-operator-status` doesn't exist after installation

**Diagnosis**:

```bash
# Check if ConfigMap exists
kubectl get configmap kube9-operator-status -n kube9-system

# Check RBAC permissions
kubectl auth can-i create configmaps \
  --namespace=kube9-system \
  --as=system:serviceaccount:kube9-system:kube9-operator

# Verify Role and RoleBinding exist
kubectl get role,rolebinding -n kube9-system | grep kube9-operator
```

**Common Causes**:
- RBAC not created: `rbac.create` was set to false
- Insufficient permissions: Role or RoleBinding missing
- Operator not running: Pod may have failed to start

**Solutions**:
- Ensure `rbac.create: true` in values.yaml
- Verify Role and RoleBinding exist: `kubectl get role,rolebinding -n kube9-system`
- Check operator logs for permission errors
- Reinstall with `rbac.create: true` if needed

### Operator reports unhealthy or errors in status

**Symptoms**: Status ConfigMap `health` is not `healthy`, `error` is set, or the extension shows stale status

**Diagnosis**:

```bash
kubectl logs -n kube9-system deployment/kube9-operator
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq .
```

**Common causes**:
- RBAC preventing ConfigMap writes
- Insufficient CPU/memory or operator startup errors
- Optional integrations (for example Trivy) timing out or misconfigured

### RBAC Permission Issues

**Symptoms**: Operator logs show permission denied errors

**Diagnosis**:

```bash
# Check ClusterRole permissions
kubectl get clusterrole kube9-operator -o yaml

# Check ClusterRoleBinding
kubectl get clusterrolebinding kube9-operator -o yaml

# Verify ServiceAccount is bound correctly
kubectl get clusterrolebinding kube9-operator -o jsonpath='{.subjects}'
```

**Common Causes**:
- RBAC not created: `rbac.create` was false during install
- ServiceAccount mismatch: ServiceAccount name doesn't match binding
- Insufficient permissions: ClusterRole missing required rules

**Solutions**:
- Reinstall with `rbac.create: true`
- Verify ServiceAccount name matches ClusterRoleBinding subject
- Check ClusterRole includes necessary permissions for ConfigMap creation
- Review operator logs for specific permission errors

## Values Reference

Complete reference of all configurable values:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podAnnotations` | Optional annotations on the operator pod (for example `prometheus.io/scrape`) | `{}` |
| `image.repository` | Container image repository | `ghcr.io/alto9/kube9-operator` |
| `image.tag` | Container image tag | `"1.3.0"` |
| `image.pullPolicy` | Image pull policy (`IfNotPresent`, `Always`, `Never`) | `IfNotPresent` |
| `resources.requests.memory` | Memory request for operator pod | `"1Gi"` |
| `resources.requests.cpu` | CPU request for operator pod | `"500m"` |
| `resources.limits.memory` | Memory limit for operator pod | `"1Gi"` |
| `resources.limits.cpu` | CPU limit for operator pod | `"500m"` |
| `serviceAccount.create` | Create a service account for the operator | `true` |
| `serviceAccount.name` | Name of the service account to create or use | `"kube9-operator"` |
| `rbac.create` | Create RBAC resources (ClusterRole and ClusterRoleBinding) | `true` |
| `logLevel` | Log level (`debug`, `info`, `warn`, `error`) | `"info"` |
| `statusUpdateIntervalSeconds` | Status ConfigMap update interval (seconds) | `60` |
| `metrics.intervals.clusterMetadata` | Cluster metadata collection interval (seconds). Default 86400 (24h), minimum 3600 (1h) | `86400` |
| `metrics.intervals.resourceInventory` | Resource inventory collection interval (seconds). Default 21600 (6h), minimum 1800 (30m) | `21600` |
| `metrics.intervals.resourceConfigurationPatterns` | Resource configuration patterns collection interval (seconds). Default 43200 (12h), minimum 3600 (1h) | `43200` |
| `events.persistence.enabled` | Enable PersistentVolume for event storage. When false, uses emptyDir | `true` |
| `events.persistence.size` | PVC size for event database | `5Gi` |
| `events.persistence.storageClassName` | Storage class for PVC. Empty uses cluster default | `""` |
| `events.persistence.accessMode` | PVC access mode | `ReadWriteOnce` |
| `events.retention.infoWarning` | Days to retain info/warning events | `7` |
| `events.retention.errorCritical` | Days to retain error/critical events | `30` |
| `argocd.autoDetect` | Enable automatic ArgoCD detection | `true` |
| `argocd.enabled` | Explicitly enable or disable ArgoCD integration (optional; bypasses CRD check when set) | - |
| `argocd.namespace` | Custom namespace where ArgoCD is installed | `"argocd"` |
| `argocd.selector` | Custom label selector for ArgoCD server deployment | `app.kubernetes.io/name=argocd-server` |
| `argocd.detectionInterval` | Detection check interval in hours (valid range: 1–24) | `6` |

## Additional Resources

- **Documentation**: https://docs.kube9.dev
- **VS Code Extension**: https://github.com/alto9/kube9-vscode
- **Project Repository**: https://github.com/alto9/kube9-operator
- **Helm Chart Best Practices**: https://helm.sh/docs/chart_best_practices/

## Support

- **Issues**: https://github.com/alto9/kube9-operator/issues
- **Discussions**: https://github.com/alto9/kube9/discussions

