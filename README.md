# kube9-operator

**Kubernetes Operator for the kube9 Ecosystem**

The kube9-operator is the core component of the kube9 open source toolkit. It runs in your Kubernetes cluster to perform Well-Architected Framework validation, provide cluster insights, and enable enhanced features in the [kube9 VS Code extension](https://github.com/alto9/kube9-vscode) and optional Helm-based UI components.

![Node.js](https://img.shields.io/badge/Node.js-22+-green) ![Kubernetes](https://img.shields.io/badge/Kubernetes-1.24+-blue) ![License](https://img.shields.io/badge/License-MIT-blue) 

## Overview

The kube9-operator is the foundation of the kube9 ecosystem. It performs Kubernetes Well-Architected Framework validation on a schedule, providing continuous cluster assessment across all 6 framework pillars (Security, Reliability, Performance Efficiency, Cost Optimization, Operational Excellence, Sustainability).

The operator works with the kube9 VS Code extension and optional Helm-based UI components to provide cluster management capabilities:

- **Basic mode** (no operator) — VS Code extension provides kubectl-focused workflows
- **Operated mode** (operator installed) — The operator runs Well-Architected Framework checks on a schedule, persists findings and events in-cluster, and publishes status to a ConfigMap for the extension and other consumers

The operator is installed via Helm and requires no ingress. It is **fully open source and self-contained**: assessments, storage, and status run inside the cluster using the Kubernetes API, optional outbound HTTP for Trivy detection when configured, and local SQLite. This operator does **not** register with kube9-server or transmit collections to it.

Paid kube9 experiences are offered separately (for example **kube9-desktop**); this repository’s chart and operator remain open source without subscription gates.

## Features

### Core capabilities
✅ Kubernetes Well-Architected Framework validation on schedule  
✅ Assessment results and operator state stored in-cluster (SQLite)  
✅ Status exposure via ConfigMap for the VS Code extension  
✅ Health and metrics endpoints for the pod  
✅ Minimal configurable resource footprint (see Helm defaults)  
✅ Optional ArgoCD and Trivy awareness when you configure those integrations  

### ArgoCD awareness
🔍 Automatic ArgoCD detection  
🔍 Configurable detection behavior  
🔍 Status exposed via OperatorStatus ConfigMap  
🔍 Foundation for future GitOps integration

The operator automatically detects if ArgoCD is installed in your cluster and exposes this information through the OperatorStatus. This enables the VS Code extension to conditionally show ArgoCD-related features and provides the foundation for future ArgoCD integration and AI-powered GitOps insights.

## Architecture

```
┌─────────────────────────────────────┐
│  VS Code Extension                  │
│  - Reads operator status            │
│  - Surfaces in-cluster insights     │
└─────────────────────────────────────┘
              │ reads
              ↓
┌─────────────────────────────────────┐
│  Kubernetes Cluster                 │
│  ┌───────────────────────────────┐  │
│  │ kube9-system namespace        │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ kube9-operator          │  │  │
│  │  │ - Assessments + storage │  │  │
│  │  │ - Writes status CM      │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Status ConfigMap        │  │  │
│  │  │ - mode / health / …    │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster (1.24+)
- `kubectl` configured with cluster access
- `helm` 3.x installed

### Installation

#### Standard Installation (Default Namespace)

The operator is conventionally installed in the `kube9-system` namespace:

```bash
# Add Helm repository
helm repo add kube9 https://charts.kube9.io
helm repo update

# Install operator
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

#### Custom Namespace Installation

The operator can be installed in any namespace. It will automatically detect its location:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace my-custom-namespace \
  --create-namespace
```

The operator uses the Kubernetes downward API to detect its namespace automatically via the `POD_NAMESPACE` environment variable. The detected namespace is advertised in the status ConfigMap, allowing external consumers (like the VS Code extension) to discover where the operator is running.

**Note:** While `kube9-system` is the conventional default used in documentation, you can use any namespace that fits your cluster organization.

### Verify Installation

```bash
# Check operator pod (replace kube9-system with your namespace if using custom namespace)
kubectl get pods -n kube9-system

# View operator logs
kubectl logs -n kube9-system deployment/kube9-operator

# Check status ConfigMap
kubectl get configmap kube9-operator-status -n kube9-system -o yaml

# Verify namespace detection (the status includes the namespace field)
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq -r '.namespace'
```

## Configuration

### Helm Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.repository` | Operator image repository | `ghcr.io/alto9/kube9-operator` |
| `image.tag` | Operator image tag | `1.0.0` |
| `resources.requests.cpu` | CPU request | `100m` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `resources.limits.cpu` | CPU limit | `200m` |
| `resources.limits.memory` | Memory limit | `256Mi` |
| `logLevel` | Log level (debug, info, warn, error) | `info` |
| `statusUpdateIntervalSeconds` | Status update frequency | `60` |
| `argocd.autoDetect` | Enable automatic ArgoCD detection | `true` |
| `argocd.enabled` | Explicitly enable or disable ArgoCD integration (optional override) | - |
| `argocd.namespace` | Custom namespace where ArgoCD is installed | `"argocd"` |
| `argocd.selector` | Custom label selector for ArgoCD server deployment | `"app.kubernetes.io/name=argocd-server"` |
| `argocd.detectionInterval` | Detection check interval in hours | `6` |

### Custom Configuration

Create a `values.yaml`:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "400m"

logLevel: debug

statusUpdateIntervalSeconds: 30
```

Install with custom values:

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace \
  --values values.yaml
```

### ArgoCD Configuration Examples

**Default auto-detection** (recommended):
```yaml
argocd:
  autoDetect: true
```

**Custom namespace**:
```yaml
argocd:
  autoDetect: true
  namespace: "gitops"  # ArgoCD installed in custom namespace
```

**Explicitly enable ArgoCD integration**:
```yaml
argocd:
  enabled: true  # Bypasses CRD check, directly checks namespace
  namespace: "argocd"
```

**Disable ArgoCD detection**:
```yaml
argocd:
  autoDetect: false  # Disables automatic detection
```

**Custom detection interval**:
```yaml
argocd:
  autoDetect: true
  detectionInterval: 12  # Check every 12 hours instead of default 6 hours
```

## Upgrading

```bash
helm repo update
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system
```

## Uninstalling

```bash
helm uninstall kube9-operator --namespace kube9-system
```

## Development

### Prerequisites

- Node.js 22+
- kubectl with cluster access
- Docker (for building images)
- minikube (for local testing)

### Local Development with Minikube

Bring up a cluster from **[kube9-localcluster](https://github.com/alto9/kube9-localcluster)** (this repo does not create clusters). Export its kubeconfig, then run the operator on your host against that API:

```bash
# From kube9-localcluster (sibling clone recommended)
./scripts/start.sh
export KUBECONFIG="$PWD/out/kubeconfig"

# From kube9-operator
npm run dev:watch   # or npm run dev
```

**Important:** Set `KUBECONFIG` to the file kube9-localcluster writes (`out/kubeconfig` by default). Use the same Minikube profile in both places (`MINIKUBE_PROFILE`, default `kube9-demo`). Environment variables for the operator process are set via npm scripts or `.env` (see `.env.example`).

The operator will:
- Run on your local machine (not in a pod)
- Connect via `kubectl` using your current `KUBECONFIG`
- Auto-reload on code changes (with `dev:watch` via nodemon)
- Create/update ConfigMaps in the target cluster

#### Prerequisites for Local Development

1. **Cluster**: [kube9-localcluster](https://github.com/alto9/kube9-localcluster) `scripts/start.sh` (or any cluster you trust)
2. **`export KUBECONFIG=.../kube9-localcluster/out/kubeconfig`** (or equivalent)
3. **`kubectl config current-context`** should match the cluster you intend (e.g. `kube9-demo` when using the localcluster profile)
4. **Environment variables**: Defaults are set in npm scripts. Override `LOG_LEVEL`, `DB_PATH`, `POD_NAMESPACE`, `HEALTH_PORT`, etc. in your shell. See [`.env.example`](.env.example) for a template. This process does **not** load `.env` files automatically; export variables in your shell, use [direnv](https://direnv.net/), or another loader so they are present before `npm run dev`.

#### Local data directory (`DB_PATH`)

The SQLite database defaults to `{DB_PATH}/kube9.db`. In production, `DB_PATH` is typically `/data`. On a developer host, `/data` may be missing or not writable.

- **`npm run dev` / `npm run dev:watch`** set `DB_PATH` to **`<repo>/.kube9-data`** when unset, so SQLite lands in a gitignored directory under the project.
- Override explicitly if needed: `export DB_PATH="$HOME/.kube9-dev"` (directory is created automatically).

#### Remote or existing clusters

You can run the operator on your machine against **any** cluster your kubeconfig can reach: managed cloud (EKS, GKE, AKS), on-prem, or minikube from kube9-localcluster.

- **API access**: The operator uses the same mechanism as `kubectl` (`KUBECONFIG` or `~/.kube/config`). If the API is reached via **`kubectl proxy`**, an SSH tunnel to `localhost:6443`, or a VPN, ensure your **current context** points at that endpoint (merge kubeconfig as needed).
- **RBAC**: Local runs use **your kubeconfig identity**, not the in-cluster Helm `ServiceAccount`. You need permission to list/watch resources and to create/update ConfigMaps in the target namespace. For a shared remote cluster, prefer a dedicated dev user or service account kubeconfig rather than personal admin credentials when possible.
- **`POD_NAMESPACE`**: Status and health ConfigMaps are written in this namespace (default `kube9-system`). Set `POD_NAMESPACE` to match where you want status published, consistent with how you use the VS Code extension or other consumers.

#### Environment Variables

`loadConfig()` does not require kube9-server URL variables. The npm scripts set defaults for `LOG_LEVEL` and (for dev scripts only) `DB_PATH`. Override as needed:

```bash
# Typical local overrides
export LOG_LEVEL=debug
export DB_PATH="$PWD/.kube9-data"
export POD_NAMESPACE=kube9-system
export HEALTH_PORT=8080

# Template for copy-paste (see .env.example); load into the environment yourself
cp .env.example .env
# Edit .env, then export (example with bash):
# set -a && source .env && set +a
```

**`HEALTH_PORT`**: Port for `/healthz`, `/readyz`, and `/metrics` (default `8080`). Increase or change if another process already binds `8080` on your machine.

#### Development Workflow

**Operator process on host (daily iteration):**
```bash
export KUBECONFIG=/path/to/kube9-localcluster/out/kubeconfig
npm run dev:watch
```

**In-cluster build (before PR):** builds a local image, loads it into the Minikube node for `MINIKUBE_PROFILE` (default `kube9-demo`), and installs/upgrades via Helm:

```bash
export KUBECONFIG=/path/to/kube9-localcluster/out/kubeconfig
npm run deploy:minikube

kubectl get pods -n kube9-system
kubectl logs -n kube9-system deployment/kube9-operator
```

**Two ways to get the operator into the cluster:**

| Flow | Use case |
|------|----------|
| `kube9-localcluster` → `./scripts/populate.sh with-operator` | Predictable demo / extension testing (Helm chart from disk + demo workloads; not necessarily your latest local image) |
| This repo → `npm run deploy:minikube` | Iterate on **local** operator code with `kube9-operator:local` image |

Use the same `KUBECONFIG` and `MINIKUBE_PROFILE` for both.

#### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run operator locally once (uses `KUBECONFIG`; defaults `DB_PATH` to `./.kube9-data`) |
| `npm run dev:watch` | Run operator locally with auto-reload on file changes |
| `npm run docker:build` | Build Docker image locally |
| `npm run docker:load:minikube` | Build and load image into minikube (`MINIKUBE_PROFILE`, default `kube9-demo`) |
| `npm run deploy:minikube` | Build, load, and deploy operator to minikube |
| `npm run clean:minikube` | Uninstall operator from minikube |

#### Helper Scripts

- **`scripts/deploy-minikube.sh`**: Builds image, loads into minikube, deploys with Helm (requires running cluster; honors `MINIKUBE_PROFILE`, default `kube9-demo`)
- **`scripts/test-helm-chart.sh`**: Lint/template/package the chart; if [kind](https://kind.sigs.k8s.io/) is installed, creates a disposable cluster (`kube9-test`), installs/upgrades/uninstalls the operator, then deletes the cluster

#### Troubleshooting

**Port 8080 already in use (health/metrics):**

```bash
export HEALTH_PORT=18080
npm run dev:watch
```

**Operator can't connect to the cluster:**
```bash
minikube status -p "${MINIKUBE_PROFILE:-kube9-demo}"
kubectl config current-context
echo "$KUBECONFIG"
```

**Image not found when deploying:**
```bash
# Ensure image is loaded into minikube
minikube image ls | grep kube9-operator

# Reload image if needed
npm run docker:load:minikube
```

**RBAC permission errors:**
```bash
# For local development, ensure you have cluster-admin permissions
kubectl auth can-i create configmaps --namespace=kube9-system
```

For more detailed troubleshooting and best practices, see:
- **Developer Actor**: [`ai/actors/users/kube9-operator-developer.actor.md`](ai/actors/users/kube9-operator-developer.actor.md)
- **Development Context**: [`ai/contexts/development/minikube-local-development.context.md`](ai/contexts/development/minikube-local-development.context.md)

### Build Docker Image

```bash
npm run docker:build
# Or manually:
docker build -t kube9-operator:local .
```

### Run Tests

```bash
# Unit tests
npm test

# Integration tests (requires minikube cluster)
npm run test:minikube
```

### Helm Chart Development

```bash
# Lint Helm chart
helm lint charts/kube9-operator

# Test template rendering
helm template kube9-operator charts/kube9-operator \
  --namespace kube9-system

# Test installation in minikube
npm run deploy:minikube
npm run clean:minikube
```

## How It Works

### Status Exposure

The operator writes its status to a ConfigMap every 60 seconds:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube9-operator-status
  namespace: kube9-system
data:
  status: |
    {
      "mode": "operated",
      "version": "1.0.0",
      "health": "healthy",
      "lastUpdate": "2025-11-10T15:30:00Z",
      "error": null,
      "namespace": "kube9-system",
      "collectionStats": {
        "totalSuccessCount": 0,
        "totalFailureCount": 0,
        "collectionsStoredCount": 0,
        "lastSuccessTime": null
      },
      "argocd": {
        "detected": true,
        "namespace": "argocd",
        "version": "v2.8.0",
        "lastChecked": "2025-11-10T15:30:00Z"
      },
      "trivy": {
        "detected": false,
        "serverUrl": null,
        "version": null,
        "lastChecked": "2025-11-10T15:30:00Z"
      },
      "assessment": {
        "lastScheduledCompletedAt": null,
        "lastScheduledOutcome": "none",
        "lastScheduledRunState": null,
        "lastScheduledRunId": null,
        "lastScheduledTotals": {
          "totalChecks": 0,
          "completedChecks": 0,
          "passedChecks": 0,
          "failedChecks": 0,
          "warningChecks": 0
        },
        "lastScheduledError": null
      }
    }
```

The VS Code extension reads this ConfigMap to discover where the operator runs, surface status, and enable optional experiences that depend on in-cluster signals (for example ArgoCD awareness).

### Operating modes (summary)

| Mode | Operator | Typical extension behavior |
|------|----------|---------------------------|
| **basic** | Not installed | kubectl-focused workflows; prompts to install the operator when appropriate |
| **operated** | Installed | Extension reads local status and cluster signals published by the operator |

Published `mode` reflects client compatibility; status matches `OperatorStatus` in `src/status/types.ts`.

### Security

- **No ingress required** for the control-plane path this chart installs
- **Minimal permissions**: ClusterRole for read-only cluster metadata, Role for ConfigMap writes in the release namespace
- **Non-root**: Runs as non-root user with read-only filesystem where configured
- **Optional outbound HTTP**: Trivy health/version probes when `trivy.serverUrl` is set; otherwise cluster API and DNS only
- **No sensitive credentials in status**: Follow your own secret-management practices for any credentials you use elsewhere in the cluster

## Troubleshooting

### Operator pod not starting

```bash
# Check pod status
kubectl get pods -n kube9-system

# View pod events
kubectl describe pod -n kube9-system -l app.kubernetes.io/name=kube9-operator

# Check logs
kubectl logs -n kube9-system deployment/kube9-operator
```

### Status ConfigMap not created

```bash
# Check RBAC permissions
kubectl auth can-i create configmaps --namespace=kube9-system --as=system:serviceaccount:kube9-system:kube9-operator

# Verify Role and RoleBinding exist
kubectl get role,rolebinding -n kube9-system
```

### Operator unhealthy or status shows errors

```bash
kubectl logs -n kube9-system deployment/kube9-operator

# View published status (health, errors, collection stats)
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq .
```

### ArgoCD detection issues

**ArgoCD not detected when it should be:**

```bash
# Check operator logs for detection errors
kubectl logs -n kube9-system deployment/kube9-operator | grep -i argocd

# Verify ArgoCD namespace configuration matches your installation
kubectl get namespace argocd  # or your custom namespace

# Check if ArgoCD server deployment exists
kubectl get deployment -n argocd -l app.kubernetes.io/name=argocd-server

# Verify Helm values configuration
helm get values kube9-operator -n kube9-system | grep argocd
```

**Permission errors (RBAC):**

ArgoCD detection requires read-only permissions for:
- CustomResourceDefinitions (to check for `applications.argoproj.io` CRD)
- Namespaces (to verify ArgoCD namespace exists)
- Deployments (to find ArgoCD server deployment)

These permissions are automatically included in the ClusterRole when `rbac.create: true` (default). To verify permissions:

```bash
# Check if operator can read CRDs
kubectl auth can-i get customresourcedefinitions --namespace=kube9-system --as=system:serviceaccount:kube9-system:kube9-operator

# Check if operator can read namespaces
kubectl auth can-i get namespaces --namespace=kube9-system --as=system:serviceaccount:kube9-system:kube9-operator

# Check if operator can list deployments
kubectl auth can-i list deployments --namespace=argocd --as=system:serviceaccount:kube9-system:kube9-operator
```

If permissions are missing, ensure `rbac.create: true` in your Helm values or manually add the required permissions to your ClusterRole.

**How to check detection status:**

```bash
# View ArgoCD status from ConfigMap
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq '.argocd'
```

The `argocd` field contains:
- `detected`: `true` if ArgoCD is detected, `false` otherwise
- `namespace`: Namespace where ArgoCD was detected (or `null` if not detected)
- `version`: ArgoCD version extracted from deployment (or `null` if unavailable)
- `lastChecked`: ISO 8601 timestamp of the last detection check

Example output when ArgoCD is detected:
```json
{
  "detected": true,
  "namespace": "argocd",
  "version": "v2.8.0",
  "lastChecked": "2025-11-20T15:30:00Z"
}
```

Example output when ArgoCD is not detected:
```json
{
  "detected": false,
  "namespace": null,
  "version": null,
  "lastChecked": "2025-11-20T15:30:00Z"
}
```

## Project Structure

```
kube9-operator/
├── ai/                          # Forge design documentation
│   ├── actors/                  # System and user actors
│   ├── contexts/                # Implementation guidance
│   ├── diagrams/                # Architecture diagrams
│   ├── features/                # Feature definitions (Gherkin)
│   ├── models/                  # Data models
│   ├── sessions/                # Design sessions
│   │   └── mvp/                 # MVP session
│   │       ├── tickets/         # Implementation stories
│   │       └── mvp.session.md
│   └── specs/                   # Technical specifications
├── charts/                      # Helm chart
│   └── kube9-operator/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
├── src/                         # TypeScript source code
│   ├── cluster/                 # Cluster identifier
│   ├── config/                  # Configuration loader
│   ├── health/                  # Health endpoints
│   ├── kubernetes/              # Kubernetes client
│   ├── logging/                 # Structured logging
│   ├── shutdown/                # Graceful shutdown
│   └── status/                  # Status calculator & writer
├── tests/                       # Tests
│   ├── integration/             # Integration tests
│   └── unit/                    # Unit tests
├── Dockerfile                   # Production container image
├── package.json                 # Node.js dependencies
└── tsconfig.json                # TypeScript configuration
```

## Related Projects

- **[kube9-vscode](https://github.com/alto9/kube9-vscode)** - VS Code extension (primary consumer)
- **[kube9-localcluster](https://github.com/alto9/kube9-localcluster)** - Local Kubernetes demo environment for development

## Documentation

- **[Design Documentation](./ai/docs/mvp-overview.md)** - Complete MVP design and architecture
- **[Implementation Stories](./ai/sessions/mvp/tickets/)** - Breakdown of implementation work
- **[API Specifications](./ai/specs/)** - Technical API specs
- **[Feature Definitions](./ai/features/)** - Feature behavior in Gherkin
- **[Assessment User Guide](./docs/assessment/user-guide.md)** - End-to-end installation, run modes, CLI usage, and result interpretation
- **[Built-In Assessment Checks](./docs/assessment/checks.md)** - Reference for all built-in assessment checks, grouped by pillar

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- How to set up your development environment
- Local development with minikube
- Our code style and conventions
- How to submit pull requests
- Testing and deployment

This project uses [Forge](https://github.com/alto9/forge) for structured context engineering:

1. Review design docs in `ai/` folder
2. Check implementation stories in `ai/sessions/mvp/tickets/`
3. Follow specs and contexts for implementation guidance
4. Update story status as work progresses

### Quick Start for Contributors

```bash
# Fork and clone kube9-operator (and clone kube9-localcluster beside it)
git clone https://github.com/alto9/kube9-operator.git
cd kube9-operator
npm install

# In another terminal: start local cluster (see kube9-localcluster README)
cd ../kube9-localcluster && ./scripts/start.sh && export KUBECONFIG="$PWD/out/kubeconfig"

# Run operator locally with auto-reload
cd ../kube9-operator
npm run dev:watch
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Documentation**: https://docs.kube9.dev
- **GitHub Issues**: https://github.com/alto9/kube9-operator/issues - Report bugs, request features
- **GitHub Discussions**: https://github.com/alto9/kube9-operator/discussions - Ask questions, share ideas
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- **Security Policy**: [SECURITY.md](SECURITY.md) - Security reporting
- **Code of Conduct**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community guidelines
---

**Built with ❤️ by Alto9 - Making Kubernetes management intelligent**
