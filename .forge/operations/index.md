# Operations

How the operator is built, deployed, observed, and secured.

- **Install**: Helm chart, GHCR image
- **Distribution**: charts.kube9.io, GitHub Actions
- **Observability**: Prometheus metrics, health checks, logging

## Child Docs
- [build_packaging.md](build_packaging.md) — Helm chart, Docker image
- [deployment_environments.md](deployment_environments.md) — Chart hosting, image publishing, **local testing** (Minikube via kube9-localcluster, kind in test-helm-chart)
- [observability.md](observability.md) — Metrics, health, logging
- [security.md](security.md) — Zero ingress, minimal RBAC
