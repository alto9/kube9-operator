# Configuration

## Environment Variables
- **POD_NAMESPACE**: Operator namespace (from downward API)
- **LOG_LEVEL**: debug, info, warn, error

## Helm Values
- image, resources, logLevel
- statusUpdateIntervalSeconds (60)
- events.retention, argocd.namespace
- argocd.endpointOverride, prometheus.endpointOverride (M1)

## In-Cluster Config
- Service account token for Kubernetes API
- No kubeconfig for in-cluster operation
