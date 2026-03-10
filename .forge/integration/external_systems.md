# External Systems

## Kubernetes API
- Primary: cluster resources, status ConfigMap, RBAC
- Operator uses in-cluster config (service account) or kubeconfig

## ArgoCD
- **Detection**: CRD-based (`applications.argoproj.io`), deployment verification
- **Default namespace**: `argocd`; configurable via Helm (M1: endpoint override)
- **Periodic refresh**: Every 6 hours
- **Status exposure**: `status.argocd.detected`, namespace, version, lastChecked
- **M9**: Application sync status, drift detection

## Prometheus
- **M1**: Endpoint override for metrics scraping
- Auto-detection as default

## kube9-vscode
- Primary consumer of operator status and CLI queries
- Reads ConfigMap for tier/health
- Execs CLI for events, assessments
