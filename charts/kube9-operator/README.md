# kube9-operator Helm Chart

This Helm chart installs the kube9-operator, a Kubernetes operator that enables enhanced features in the [kube9 VS Code extension](https://github.com/alto9/kube9-vscode). The operator provides tier detection, status reporting, and optional Pro tier features with AI-powered insights.

## Overview

The kube9-operator runs in your Kubernetes cluster and bridges your cluster with the kube9 VS Code extension. It enables the extension to determine whether your cluster is in:

- **Basic mode** (no operator) - kubectl-only operations
- **Free tier** (operated mode) - Local webviews and basic resource management
- **Pro tier** (enabled mode) - AI-powered insights, advanced dashboards, and rich UIs

The operator is installed via Helm and requires no ingress - all communication is outbound to kube9-server for Pro tier features.

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

## Configuration

The following table lists the configurable parameters and their default values:

| Parameter | Description | Default |
|-----------|-------------|---------|
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
| `reregistrationIntervalHours` | How often the operator re-registers with kube9-server (in hours, Pro tier only) | `24` |
| `serverUrl` | URL of the kube9-server API | `"https://api.kube9.io"` |
| `metrics.intervals.clusterMetadata` | Cluster metadata collection interval (seconds). Default 86400 (24h), minimum 3600 (1h) | `86400` |
| `metrics.intervals.resourceInventory` | Resource inventory collection interval (seconds). Default 21600 (6h), minimum 1800 (30m) | `21600` |
| `metrics.intervals.resourceConfigurationPatterns` | Resource configuration patterns collection interval (seconds). Default 43200 (12h), minimum 3600 (1h) | `43200` |

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

#### Status Intervals and Server URL

- **statusUpdateIntervalSeconds**: How frequently the operator writes status to the ConfigMap (default: 60 seconds). Lower values provide more real-time status but increase API calls; higher values reduce API load but status may be slightly stale.
- **reregistrationIntervalHours**: How often to re-register with kube9-server (default: 24 hours)
- **serverUrl**: The kube9-server API endpoint (default: https://api.kube9.io)

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

### Registration Failing

**Symptoms**: Status shows `registered: false` or `mode: degraded`

**Diagnosis**:

```bash
# Check registration status in logs
kubectl logs -n kube9-system deployment/kube9-operator | grep -i registration

# View status ConfigMap with error details
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq .
```

**Common Causes**:
- Network connectivity: Cluster cannot reach the kube9-server API
- Server URL incorrect: Wrong `serverUrl` value

**Solutions**:
- Test connectivity: `kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl -v https://api.kube9.io/health`
- Verify `serverUrl` is set to `https://api.kube9.io`
- Review operator logs for specific error messages

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
| `reregistrationIntervalHours` | Re-registration interval with kube9-server (hours, Pro tier) | `24` |
| `serverUrl` | kube9-server API URL | `"https://api.kube9.io"` |
| `metrics.intervals.clusterMetadata` | Cluster metadata collection interval (seconds). Default 86400 (24h), minimum 3600 (1h) | `86400` |
| `metrics.intervals.resourceInventory` | Resource inventory collection interval (seconds). Default 21600 (6h), minimum 1800 (30m) | `21600` |
| `metrics.intervals.resourceConfigurationPatterns` | Resource configuration patterns collection interval (seconds). Default 43200 (12h), minimum 3600 (1h) | `43200` |

## Additional Resources

- **Documentation**: https://docs.kube9.dev
- **VS Code Extension**: https://github.com/alto9/kube9-vscode
- **Project Repository**: https://github.com/alto9/kube9-operator
- **Helm Chart Best Practices**: https://helm.sh/docs/chart_best_practices/

## Support

- **Issues**: https://github.com/alto9/kube9-operator/issues
- **Discussions**: https://github.com/alto9/kube9/discussions
- **Portal Support**: https://portal.kube9.dev/support

