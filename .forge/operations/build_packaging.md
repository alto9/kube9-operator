# Build & Packaging

## Helm Chart
- **Name**: kube9-operator
- **Repository**: https://charts.kube9.io
- **Values**: image, resources, logLevel, statusUpdateIntervalSeconds, argocd config, prometheus/argocd endpoint overrides (M1), etc.
- **Namespace**: kube9-system default; configurable

## Docker Image
- **Registry**: ghcr.io/alto9/kube9-operator
- **Build**: On release via GitHub Actions
- **Base**: Node.js 22

## Chart Metadata
- Kubernetes >= 1.24.0
- Chart version follows SemVer
