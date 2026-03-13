# Configuration

## Environment Variables
- **POD_NAMESPACE**: Operator namespace (from downward API)
- **LOG_LEVEL**: debug, info, warn, error
- **PROMETHEUS_PORT**: Port for health server and metrics (default: 8080)
- **PROMETHEUS_METRICS_PATH**: Path for Prometheus metrics endpoint (default: /metrics)
- **ARGOCD_ENDPOINT_OVERRIDE**: Override ArgoCD API endpoint (full URL). When set, used for ArgoCD API access (M9). Detection continues to use namespace/selector for deployment lookup.

## Helm Values
- image, resources, logLevel
- statusUpdateIntervalSeconds (60)
- events.retention, argocd.namespace
- argocd.endpointOverride: Override ArgoCD API endpoint (full URL). When set, used for ArgoCD API access (M9). Detection continues to use namespace/selector for deployment lookup.
- prometheus.port (default: 8080), prometheus.metricsPath (default: /metrics)

## In-Cluster Config
- Service account token for Kubernetes API
- No kubeconfig for in-cluster operation
