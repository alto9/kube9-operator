---
actor_id: kube9-operator-developer
type: user
---

# kube9-operator Developer

## Overview

The kube9-operator Developer is responsible for developing, testing, and debugging the kube9-operator locally using minikube. This developer works on the operator codebase, iterates quickly on features, and verifies functionality before deployment.

## Responsibilities

- Develop and test operator features locally
- Debug operator behavior in local environment
- Iterate quickly without Docker rebuilds
- Verify operator functionality before deployment
- Write and run integration tests against local cluster
- Troubleshoot local development issues

## Characteristics

- **Technical Level**: Experienced with Node.js, TypeScript, Kubernetes, and minikube
- **Tools**: npm, Node.js 22+, minikube, kubectl, helm, Docker
- **Workflow**: Prefers fast iteration cycles with local development
- **Environment**: Uses minikube for local Kubernetes cluster
- **Development Style**: Runs operator locally with `npm run dev`, connects to minikube via kubeconfig

## Usage Patterns

### Starting Local Development

```bash
# Start minikube cluster
minikube start

# Run operator locally (connects to minikube via kubeconfig)
npm run dev
```

### Building and Deploying to Minikube

```bash
# Build Docker image and deploy to minikube
npm run deploy:minikube

# Or manually:
npm run docker:load:minikube
helm install kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --set image.repository=kube9-operator \
  --set image.tag=local \
  --set image.pullPolicy=Never
```

### Checking Status

```bash
# View operator logs (when running locally)
# Logs appear in terminal where npm run dev is running

# View operator logs (when deployed to minikube)
kubectl logs -n kube9-system deployment/kube9-operator

# Check status ConfigMap
kubectl get configmap kube9-operator-status -n kube9-system -o yaml
```

### Cleaning Up

```bash
# Uninstall from minikube
npm run clean:minikube

# Stop minikube
minikube stop

# Delete minikube cluster
minikube delete
```

## Expectations

- **Fast Iteration**: Local development should eliminate Docker build/deploy cycle
- **Clear Errors**: Error messages should clearly indicate configuration issues
- **Easy Setup**: Local environment should be easy to set up and tear down
- **Hot Reload**: Code changes should be reflected immediately via nodemon
- **Kubeconfig Support**: Operator should work with local kubeconfig for minikube
- **Discoverable Commands**: All workflows accessible via `npm run`

## Pain Points

- Wants to avoid slow Docker rebuild/redeploy cycles during development
- Needs to test operator behavior quickly and frequently
- Requires clear error messages when kubeconfig is misconfigured
- Wants simple commands for common development tasks
- Needs to verify operator works correctly before creating PRs

## Development Workflow

1. **Start minikube**: `minikube start`
2. **Run locally**: `npm run dev` (operator runs on host, connects to minikube)
3. **Edit code**: Changes auto-reload via nodemon
4. **Test functionality**: Verify operator behavior in minikube cluster
5. **Deploy to minikube** (optional): `npm run deploy:minikube` for in-cluster testing
6. **Clean up**: `npm run clean:minikube` when done

## Key Differences from Cluster Administrator

- **Focus**: Development and testing vs production deployment
- **Environment**: Local minikube cluster vs production cluster
- **Workflow**: Fast iteration with local code vs Helm-based deployment
- **Tools**: npm scripts vs helm commands
- **Goals**: Feature development vs cluster management

