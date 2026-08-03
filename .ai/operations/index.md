# Operations

How the operator is built, deployed, observed, and secured.

- **Install**: Helm chart, GHCR image
- **Distribution**: charts.kube9.io, GitHub Actions
- **Observability**: Prometheus metrics (operator `/metrics` exposition plus optional outbound Prometheus for performance collection), health checks, logging
- **Collectors packaging**: Interval keys under `metrics.intervals` for core collectors including performance metrics (~15m) and security posture (~24h); no collections TTL / count-cap knobs; PVC growth is operational
- **Agent / Desktop history consumers**: Best-effort queryable history when the operator is ready and persistence uses the chart default PVC. Advertised event retention stays severity-split **7** / **30** days. No log-capture ops, assessment TTL knobs, or Pro-debugging gate on operator install.

## Child Docs
- [build_packaging.md](build_packaging.md) — Helm chart, Docker image; collection intervals; optional Prometheus values posture; advertised event retention defaults; packaging non-goals for log capture and collections TTL
- [deployment_environments.md](deployment_environments.md) — Chart hosting, image publishing, **local testing** (Minikube via kube9-minikube, kind in test-helm-chart); agent-consumer availability posture; collections disk-growth note
- [observability.md](observability.md) — Metrics, health, logging; collection `type` labels and aggregate `collectionStats`
- [security.md](security.md) — Zero ingress, minimal RBAC (chart-synced ClusterRole); optional Trivy / Prometheus outbound degrade
