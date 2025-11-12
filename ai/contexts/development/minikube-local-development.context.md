---
context_id: minikube-local-development
category: development
---

# Minikube Local Development Context

## Overview

This context provides guidance for developing and testing the kube9-operator locally using minikube. It covers local development workflows, minikube setup, and best practices for operator development.

## When to Use This Context

```gherkin
Scenario: Developing kube9-operator locally
  Given you are developing the kube9-operator
  When you need to test operator functionality locally
  Then use minikube for local Kubernetes cluster
  And run operator locally with npm run dev
  And connect to minikube via kubeconfig
```

```gherkin
Scenario: Testing operator in-cluster locally
  Given you want to test containerized operator deployment
  When you need to verify Docker image and Helm chart
  Then build Docker image locally
  And load image into minikube
  And deploy with Helm using local image
```

## Local Development vs In-Cluster Testing

### Local Development (Recommended for Daily Work)

**When to use:**
- Developing new features
- Debugging operator behavior
- Fast iteration cycles
- Writing and testing code changes

**Workflow:**
```bash
minikube start
npm run dev  # Operator runs on host, connects to minikube
```

**Benefits:**
- No Docker rebuilds required
- Instant code reload via nodemon
- Fast iteration cycle
- Easy debugging with local tools

### In-Cluster Testing (Recommended Before PR)

**When to use:**
- Verifying Docker image builds correctly
- Testing Helm chart deployment
- Validating containerized behavior
- Final verification before PR

**Workflow:**
```bash
npm run deploy:minikube  # Builds image, loads into minikube, deploys
```

**Benefits:**
- Tests actual containerized deployment
- Verifies Helm chart works correctly
- Closer to production environment

## KubernetesClient Configuration

### Local Development Setup

The KubernetesClient should support both in-cluster and local development:

```typescript
// In src/kubernetes/client.ts
constructor() {
  this.kubeConfig = new k8s.KubeConfig();
  
  // Try in-cluster config first (for production)
  try {
    this.kubeConfig.loadFromCluster();
  } catch (inClusterError) {
    // Fall back to default kubeconfig (for local development)
    this.kubeConfig.loadFromDefault();
  }
  
  this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
  this.versionApi = this.kubeConfig.makeApiClient(k8s.VersionApi);
}
```

**Key Points:**
- `loadFromCluster()` works when running as a pod in Kubernetes
- `loadFromDefault()` reads from `KUBECONFIG` env var or `~/.kube/config`
- minikube automatically configures `~/.kube/config` when started
- Local development uses kubeconfig, production uses in-cluster config

## Minikube Setup

### Prerequisites

```gherkin
Scenario: Setting up minikube for operator development
  Given you want to develop kube9-operator locally
  When setting up the development environment
  Then install minikube
  And install kubectl
  And install helm
  And ensure Node.js 22+ is installed
```

### Starting Minikube

```bash
# Start minikube cluster
minikube start

# Verify cluster is running
minikube status

# Verify kubectl context is set
kubectl config current-context  # Should show "minikube"
```

### Minikube Configuration

```bash
# Check minikube version
minikube version

# View minikube configuration
minikube config view

# Set resources (optional)
minikube config set memory 4096
minikube config set cpus 2
```

## Running Operator Locally

### Basic Workflow

```gherkin
Scenario: Running operator locally with minikube
  Given minikube cluster is running
  When you run npm run dev
  Then operator starts on your local machine
  And operator connects to minikube via kubeconfig
  And code changes auto-reload via nodemon
  And operator can read/write to minikube cluster
```

### Command

```bash
npm run dev
```

**What happens:**
1. Nodemon watches for file changes
2. TypeScript is compiled on-the-fly with ts-node
3. Operator connects to minikube using default kubeconfig
4. Operator can create/update ConfigMaps in minikube
5. Code changes trigger automatic restart

### Verifying Local Connection

```bash
# In another terminal, check operator can access cluster
kubectl get nodes

# Check operator logs (from npm run dev terminal)
# Should see: "Loaded Kubernetes config from default kubeconfig (local development mode)"
```

## Building and Loading Images into Minikube

### Building Docker Image

```gherkin
Scenario: Building operator Docker image
  Given you want to test containerized operator
  When building the Docker image
  Then use npm run docker:build
  And image is tagged as kube9-operator:local
```

```bash
npm run docker:build
# Equivalent to: docker build -t kube9-operator:local .
```

### Loading Image into Minikube

```gherkin
Scenario: Loading image into minikube
  Given Docker image is built
  When loading image into minikube
  Then use minikube image load
  And image becomes available in minikube's Docker daemon
```

```bash
npm run docker:load:minikube
# Equivalent to: minikube image load kube9-operator:local
```

**Important Notes:**
- minikube has its own Docker daemon
- Images built on host are NOT automatically available in minikube
- Must explicitly load images using `minikube image load`
- Alternative: `eval $(minikube docker-env)` to use minikube's Docker daemon directly

## Deploying to Minikube

### Helm Deployment with Local Image

```gherkin
Scenario: Deploying operator to minikube
  Given Docker image is loaded into minikube
  When deploying with Helm
  Then set image.repository to kube9-operator
  And set image.tag to local
  And set image.pullPolicy to Never
  And deploy to kube9-system namespace
```

### Using npm Script

```bash
npm run deploy:minikube
```

### Manual Deployment

```bash
helm install kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --set image.repository=kube9-operator \
  --set image.tag=local \
  --set image.pullPolicy=Never
```

**Key Parameters:**
- `image.repository=kube9-operator`: Local image name (no registry prefix)
- `image.tag=local`: Tag used when building image
- `image.pullPolicy=Never`: Prevents Kubernetes from trying to pull from remote registry

## RBAC Considerations

### Local Development

When running operator locally:
- Uses kubeconfig credentials (typically your user account)
- Needs cluster-admin or equivalent permissions
- Can create/update ConfigMaps in kube9-system namespace
- Can read cluster metadata (nodes, version)

### Verifying Permissions

```bash
# Check if you can create ConfigMaps
kubectl auth can-i create configmaps --namespace=kube9-system

# Check if you can read nodes
kubectl auth can-i get nodes

# If permissions are insufficient, grant cluster-admin (development only)
kubectl create clusterrolebinding developer-cluster-admin \
  --clusterrole=cluster-admin \
  --user=$(kubectl config view -o jsonpath='{.users[?(@.name=="minikube")].user.client-certificate-data}' | base64 -d | openssl x509 -noout -subject | sed 's/.*CN=\(.*\)/\1/')
```

## Troubleshooting

### Operator Can't Connect to Cluster

```gherkin
Scenario: Troubleshooting cluster connection
  Given operator fails to connect to minikube
  When checking the issue
  Then verify minikube is running
  And verify kubectl context is set to minikube
  And verify kubeconfig file exists
  And check operator logs for connection errors
```

**Common Issues:**

1. **minikube not running**
   ```bash
   minikube status
   minikube start
   ```

2. **Wrong kubectl context**
   ```bash
   kubectl config current-context
   kubectl config use-context minikube
   ```

3. **Kubeconfig not found**
   ```bash
   ls ~/.kube/config
   minikube start  # Creates kubeconfig automatically
   ```

### Image Not Found in Minikube

```gherkin
Scenario: Troubleshooting image loading
  Given Helm deployment fails with ImagePullBackOff
  When checking the issue
  Then verify image was loaded into minikube
  And verify image name and tag match Helm values
  And verify imagePullPolicy is set to Never
```

**Common Issues:**

1. **Image not loaded**
   ```bash
   minikube image ls | grep kube9-operator
   minikube image load kube9-operator:local
   ```

2. **Wrong image name/tag**
   ```bash
   # Verify Helm values match image name/tag
   helm get values kube9-operator -n kube9-system
   ```

3. **ImagePullPolicy not set**
   ```bash
   # Must set imagePullPolicy=Never for local images
   helm upgrade kube9-operator charts/kube9-operator \
     --set image.pullPolicy=Never
   ```

### RBAC Permission Errors

```gherkin
Scenario: Troubleshooting RBAC issues
  Given operator fails with permission errors
  When checking RBAC
  Then verify user has cluster-admin permissions
  And verify Role and RoleBinding exist in namespace
  And check operator logs for specific permission errors
```

**Common Issues:**

1. **Insufficient permissions**
   ```bash
   kubectl auth can-i create configmaps --namespace=kube9-system
   # Grant cluster-admin for development
   ```

2. **RBAC resources missing**
   ```bash
   kubectl get role,rolebinding -n kube9-system
   # Helm chart should create these automatically
   ```

## Best Practices

### Development Workflow

1. **Start with local development**: Use `npm run dev` for fast iteration
2. **Test in-cluster before PR**: Use `npm run deploy:minikube` for final verification
3. **Clean up regularly**: Use `npm run clean:minikube` to remove test deployments
4. **Use proper image tags**: Use `local` tag for development, semantic versions for releases

### Code Organization

- Keep KubernetesClient flexible: Support both in-cluster and kubeconfig
- Log configuration source: Help debug connection issues
- Handle errors gracefully: Provide clear error messages for common issues

### Testing

- Test locally first: Faster iteration with `npm run dev`
- Verify in-cluster: Test actual Docker image before PR
- Check both modes: Ensure operator works in both local and in-cluster modes

## Resources

- **minikube documentation**: https://minikube.sigs.k8s.io/docs/
- **Kubernetes client-node**: https://github.com/kubernetes-client/javascript
- **Helm documentation**: https://helm.sh/docs/
- **kube9-operator developer actor**: `ai/actors/users/kube9-operator-developer.actor.md`

