# Operations

How the operator is built, deployed, observed, and secured.

- **Install**: Helm chart, GHCR image
- **Distribution**: charts.kube9.io, GitHub Actions
- **Observability**: Prometheus metrics, health checks, logging
- **Agent / Desktop history consumers**: Best-effort queryable history when the operator is ready and persistence uses the chart default PVC. Advertised event retention stays severity-split **7** / **30** days. No log-capture ops, assessment TTL knobs, or Pro-debugging gate on operator install.

## Child Docs
- [build_packaging.md](build_packaging.md) — Helm chart, Docker image; advertised event retention defaults; packaging non-goals for log capture
- [deployment_environments.md](deployment_environments.md) — Chart hosting, image publishing, **local testing** (Minikube via kube9-minikube, kind in test-helm-chart); agent-consumer availability posture
- [observability.md](observability.md) — Metrics, health, logging
- [security.md](security.md) — Zero ingress, minimal RBAC
