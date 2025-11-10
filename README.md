# kube9-operator

**Kubernetes Operator for the kube9 VS Code Extension**

The kube9-operator runs in your Kubernetes cluster to enable enhanced features in the [kube9 VS Code extension](https://github.com/alto9/kube9-vscode). It provides tier detection, status reporting, and optional Pro tier features with AI-powered insights.

![Node.js](https://img.shields.io/badge/Node.js-22+-green) ![Kubernetes](https://img.shields.io/badge/Kubernetes-1.24+-blue) ![License](https://img.shields.io/badge/License-MIT-blue)

## Overview

The kube9-operator bridges your Kubernetes cluster with the kube9 VS Code extension, enabling the extension to determine whether your cluster is in:

- **Basic mode** (no operator) - kubectl-only operations
- **Free tier** (operated mode) - Local webviews and basic resource management
- **Pro tier** (enabled mode) - AI-powered insights, advanced dashboards, and rich UIs

The operator is installed via Helm and requires no ingress - all communication is outbound to kube9-server for Pro tier features.

## Features

### Free Tier (No API Key)
✅ Status exposure via ConfigMap  
✅ Cluster tier detection for VS Code extension  
✅ Health monitoring  
✅ Minimal resource footprint (~100m CPU, 128Mi RAM)  
✅ No external communication

### Pro Tier (With API Key)
✨ All Free tier features  
✨ Registration with kube9-server  
✨ API key validation  
✨ Enables AI-powered features in VS Code extension  
✨ Enhanced dashboards and insights  
✨ Advanced cluster analytics

## Architecture

```
┌─────────────────────────────────────┐
│  VS Code Extension                  │
│  - Reads operator status            │
│  - Enables features based on tier   │
└─────────────────────────────────────┘
              │ reads
              ↓
┌─────────────────────────────────────┐
│  Kubernetes Cluster                 │
│  ┌───────────────────────────────┐  │
│  │ kube9-system namespace        │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ kube9-operator          │  │  │
│  │  │ - Mode: operated/enabled│  │  │
│  │  │ - Writes status         │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Status ConfigMap        │  │  │
│  │  │ - tier: free/pro        │  │  │
│  │  │ - health: healthy       │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              │ (Pro tier only)
              ↓ registers
┌─────────────────────────────────────┐
│  kube9-server (api.kube9.dev)       │
│  - Validates API keys               │
│  - Enables Pro features             │
└─────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster (1.24+)
- `kubectl` configured with cluster access
- `helm` 3.x installed

### Install Free Tier

```bash
# Add Helm repository
helm repo add kube9 https://charts.kube9.dev
helm repo update

# Install operator (no API key = free tier)
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

### Install Pro Tier

1. **Get your API key** from [portal.kube9.dev](https://portal.kube9.dev)

2. **Install with API key:**
```bash
helm install kube9-operator kube9/kube9-operator \
  --set apiKey=kdy_prod_YOUR_KEY_HERE \
  --namespace kube9-system \
  --create-namespace
```

### Verify Installation

```bash
# Check operator pod
kubectl get pods -n kube9-system

# View operator logs
kubectl logs -n kube9-system deployment/kube9-operator

# Check status ConfigMap
kubectl get configmap kube9-operator-status -n kube9-system -o yaml
```

## Configuration

### Helm Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `apiKey` | Optional API key for Pro tier | `""` |
| `image.repository` | Operator image repository | `ghcr.io/alto9/kube9-operator` |
| `image.tag` | Operator image tag | `1.0.0` |
| `resources.requests.cpu` | CPU request | `100m` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `resources.limits.cpu` | CPU limit | `200m` |
| `resources.limits.memory` | Memory limit | `256Mi` |
| `logLevel` | Log level (debug, info, warn, error) | `info` |
| `statusUpdateIntervalSeconds` | Status update frequency | `60` |
| `serverUrl` | kube9-server URL (Pro tier) | `https://api.kube9.dev` |

### Custom Configuration

Create a `values.yaml`:

```yaml
apiKey: kdy_prod_YOUR_KEY_HERE

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

## Upgrading

### Add API Key (Free → Pro)

```bash
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --set apiKey=kdy_prod_YOUR_KEY_HERE \
  --reuse-values
```

### Update to New Version

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
- Kind or Minikube (for local testing)

### Local Development

```bash
# Clone repository
git clone https://github.com/alto9/kube9-operator.git
cd kube9-operator

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally (requires kubeconfig)
npm run dev
```

### Build Docker Image

```bash
docker build -t kube9-operator:dev .
```

### Run Tests

```bash
# Unit tests
npm test

# Integration tests (requires Kind cluster)
npm run test:integration
```

### Helm Chart Development

```bash
# Lint Helm chart
helm lint charts/kube9-operator

# Test template rendering
helm template kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --set apiKey=test123

# Test installation in Kind
kind create cluster --name kube9-test
helm install kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --create-namespace
kind delete cluster --name kube9-test
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
      "mode": "enabled",
      "tier": "pro",
      "version": "1.0.0",
      "health": "healthy",
      "lastUpdate": "2025-11-10T15:30:00Z",
      "registered": true,
      "error": null
    }
```

The VS Code extension reads this ConfigMap to:
- Determine which features to enable
- Show appropriate UI (local vs rich web UIs)
- Display cluster status to the user

### Tier Modes

| Mode | API Key | Registered | Extension Behavior |
|------|---------|------------|--------------------|
| **basic** | No operator | - | kubectl-only operations, show installation prompts |
| **operated** | Installed, no key | No | Local webviews, basic features, show upgrade prompts |
| **enabled** | Installed, has key | Yes | Rich UIs from server, AI features, advanced dashboards |
| **degraded** | Installed, has key | No | Temporary fallback, registration failed |

### Security

- **No Ingress Required**: Operator only makes outbound HTTPS connections
- **API Key Storage**: Stored in Kubernetes Secrets, never logged
- **Minimal Permissions**: ClusterRole for read-only cluster metadata, Role for ConfigMap writes
- **Non-Root**: Runs as non-root user with read-only filesystem
- **No Sensitive Data**: Status exposes no credentials or sensitive cluster information

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

### Pro tier not working

```bash
# Verify API key Secret exists
kubectl get secret kube9-operator-config -n kube9-system

# Check registration status in logs
kubectl logs -n kube9-system deployment/kube9-operator | grep -i registration

# View status with error details
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq .
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
│   ├── registration/            # Server registration
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
- **[kube9-server](https://github.com/alto9/kube9-server)** - Backend server for Pro features
- **[kube9-portal](https://github.com/alto9/kube9-portal)** - User portal for account management

## Documentation

- **[Design Documentation](./ai/docs/mvp-overview.md)** - Complete MVP design and architecture
- **[Implementation Stories](./ai/sessions/mvp/tickets/)** - Breakdown of implementation work
- **[API Specifications](./ai/specs/)** - Technical API specs
- **[Feature Definitions](./ai/features/)** - Feature behavior in Gherkin

## Contributing

This project uses [Forge](https://github.com/alto9/forge) for structured context engineering:

1. Review design docs in `ai/` folder
2. Check implementation stories in `ai/sessions/mvp/tickets/`
3. Follow specs and contexts for implementation guidance
4. Update story status as work progresses

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Documentation**: https://docs.kube9.dev
- **Issues**: https://github.com/alto9/kube9-operator/issues
- **Discussions**: https://github.com/alto9/kube9/discussions
- **Portal Support**: https://portal.kube9.dev/support

---

**Built with ❤️ by Alto9 - Making Kubernetes management intelligent**
