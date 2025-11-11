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
- **Secret**: Kubernetes Secret containing API key (only if `apiKey` is provided)
- **ConfigMap**: Status ConfigMap written by the operator (created automatically by the operator)

## Prerequisites

- Kubernetes cluster version 1.24.0 or higher
- `kubectl` configured with cluster access and appropriate permissions
- Helm 3.x installed
- Cluster administrator permissions (for initial installation)

## Installation

### Add the Helm Repository

```bash
helm repo add kube9 https://charts.kube9.dev
helm repo update
```

### Install Free Tier (No API Key)

The operator can run in free tier mode without an API key. This enables basic features and status exposure.

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

After installation, the operator will:
- Start in "operated" (free tier) mode
- Create a status ConfigMap for the VS Code extension to read
- **Not** attempt to connect to kube9-server
- Provide basic cluster status information

### Install Pro Tier (With API Key)

To enable Pro tier features including AI-powered insights and advanced dashboards, install with an API key.

1. **Get your API key** from [portal.kube9.dev](https://portal.kube9.dev)

2. **Install with API key:**

```bash
helm install kube9-operator kube9/kube9-operator \
  --set apiKey=kdy_prod_YOUR_KEY_HERE \
  --namespace kube9-system \
  --create-namespace
```

After installation, the operator will:
- Start in "enabled" (pro tier) mode
- Store the API key securely in a Kubernetes Secret
- Register with kube9-server
- Create a status ConfigMap indicating pro tier status
- Enable Pro features in the VS Code extension

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
| `apiKey` | API key for Pro tier. Get from https://portal.kube9.dev. Leave empty for free tier. | `""` |
| `image.repository` | Container image repository | `ghcr.io/alto9/kube9-operator` |
| `image.tag` | Container image tag | `"1.0.0"` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `resources.requests.memory` | Memory request for operator pod | `"128Mi"` |
| `resources.requests.cpu` | CPU request for operator pod | `"100m"` |
| `resources.limits.memory` | Memory limit for operator pod | `"256Mi"` |
| `resources.limits.cpu` | CPU limit for operator pod | `"200m"` |
| `serviceAccount.create` | Create a service account for the operator | `true` |
| `serviceAccount.name` | Name of the service account to create or use | `"kube9-operator"` |
| `rbac.create` | Create RBAC resources (ClusterRole and ClusterRoleBinding) | `true` |
| `logLevel` | Log level for the operator. Options: `debug`, `info`, `warn`, `error` | `"info"` |
| `statusUpdateIntervalSeconds` | How often the operator updates the status ConfigMap (in seconds) | `60` |
| `reregistrationIntervalHours` | How often the operator re-registers with kube9-server (in hours, Pro tier only) | `24` |
| `serverUrl` | URL of the kube9-server API (Pro tier only) | `"https://api.kube9.dev"` |

### Configuration Details

#### API Key (`apiKey`)

- **Required for Pro tier**: Set this to enable Pro features
- **Optional for free tier**: Leave empty to run in free tier mode
- **Security**: Stored securely in a Kubernetes Secret, never logged or exposed
- **Format**: API keys typically start with `kdy_prod_` or `kdy_test_`
- **Obtain from**: [portal.kube9.dev](https://portal.kube9.dev)

#### Image Configuration (`image.*`)

- **repository**: The container image repository. Default points to the official kube9-operator image.
- **tag**: The image tag/version to deploy. Defaults to chart version.
- **pullPolicy**: When to pull the image. `IfNotPresent` (default) pulls only if not already present, `Always` always pulls.

#### Resource Limits (`resources.*`)

The operator is designed to be lightweight:
- **Default requests**: 100m CPU, 128Mi memory
- **Default limits**: 200m CPU, 256Mi memory
- Adjust based on your cluster's resource constraints

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

#### Status Updates (`statusUpdateIntervalSeconds`)

- How frequently the operator writes status to the ConfigMap
- Default: 60 seconds
- Lower values provide more real-time status but increase API calls
- Higher values reduce API load but status may be slightly stale

#### Pro Tier Settings

- **reregistrationIntervalHours**: How often to re-register with kube9-server (default: 24 hours)
- **serverUrl**: The kube9-server API endpoint (default: https://api.kube9.dev)

## Examples

### Custom Values File

Create a `custom-values.yaml` file:

```yaml
# Pro tier configuration
apiKey: kdy_prod_YOUR_KEY_HERE

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
  tag: "1.0.0"
```

Install with custom values:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --values custom-values.yaml
```

### Upgrade from Free Tier to Pro Tier

If you installed without an API key and want to upgrade to Pro tier:

```bash
# Get your API key from https://portal.kube9.dev
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --set apiKey=kdy_prod_YOUR_KEY_HERE \
  --reuse-values
```

The `--reuse-values` flag preserves your existing configuration while adding the API key.

### Upgrade to New Version

To upgrade to a newer version of the operator:

```bash
# Update Helm repository
helm repo update

# Upgrade the release
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system
```

Existing configuration (including API key) will be preserved.

### Uninstall

To remove the operator and all associated resources:

```bash
helm uninstall kube9-operator --namespace kube9-system
```

This removes:
- The operator Deployment
- ServiceAccount (if created by the chart)
- Secret (if API key was provided)
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
- Verify image exists: `docker pull ghcr.io/alto9/kube9-operator:1.0.0`
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

### Pro Tier Registration Failing

**Symptoms**: Operator installed with API key but status shows `registered: false` or `mode: degraded`

**Diagnosis**:

```bash
# Check registration status in logs
kubectl logs -n kube9-system deployment/kube9-operator | grep -i registration

# View status ConfigMap with error details
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq .

# Verify Secret exists
kubectl get secret kube9-operator-config -n kube9-system

# Check API key format (first few characters only)
kubectl get secret kube9-operator-config -n kube9-system -o jsonpath='{.data.apiKey}' | base64 -d | head -c 20
```

**Common Causes**:
- Invalid API key: Key may be incorrect or expired
- Network connectivity: Cluster cannot reach api.kube9.dev
- Secret not created: API key not properly stored
- Server URL incorrect: Wrong `serverUrl` value

**Solutions**:
- Verify API key at [portal.kube9.dev](https://portal.kube9.dev)
- Test connectivity: `kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl -v https://api.kube9.dev/health`
- Check Secret exists and contains correct key
- Verify `serverUrl` is set to `https://api.kube9.dev`
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
| `apiKey` | API key for Pro tier. Get from https://portal.kube9.dev. Leave empty for free tier. | `""` |
| `image.repository` | Container image repository | `ghcr.io/alto9/kube9-operator` |
| `image.tag` | Container image tag | `"1.0.0"` |
| `image.pullPolicy` | Image pull policy (`IfNotPresent`, `Always`, `Never`) | `IfNotPresent` |
| `resources.requests.memory` | Memory request for operator pod | `"128Mi"` |
| `resources.requests.cpu` | CPU request for operator pod | `"100m"` |
| `resources.limits.memory` | Memory limit for operator pod | `"256Mi"` |
| `resources.limits.cpu` | CPU limit for operator pod | `"200m"` |
| `serviceAccount.create` | Create a service account for the operator | `true` |
| `serviceAccount.name` | Name of the service account to create or use | `"kube9-operator"` |
| `rbac.create` | Create RBAC resources (ClusterRole and ClusterRoleBinding) | `true` |
| `logLevel` | Log level (`debug`, `info`, `warn`, `error`) | `"info"` |
| `statusUpdateIntervalSeconds` | Status ConfigMap update interval (seconds) | `60` |
| `reregistrationIntervalHours` | Re-registration interval with kube9-server (hours, Pro tier) | `24` |
| `serverUrl` | kube9-server API URL (Pro tier) | `"https://api.kube9.dev"` |

## Additional Resources

- **Documentation**: https://docs.kube9.dev
- **Get API Key**: https://portal.kube9.dev
- **VS Code Extension**: https://github.com/alto9/kube9-vscode
- **Project Repository**: https://github.com/alto9/kube9-operator
- **Helm Chart Best Practices**: https://helm.sh/docs/chart_best_practices/

## Support

- **Issues**: https://github.com/alto9/kube9-operator/issues
- **Discussions**: https://github.com/alto9/kube9/discussions
- **Portal Support**: https://portal.kube9.dev/support

