# Integration

How the operator connects to external APIs and systems.

- **Kubernetes**: Cluster resources, ConfigMap
- **ArgoCD**: Detection, endpoint override (M1); Application status (M9)
- **Prometheus**: Endpoint override (M1) for metrics scraping

## Child Docs
- [api_contracts.md](api_contracts.md) — Extension↔operator, CLI contracts
- [external_systems.md](external_systems.md) — Kubernetes, ArgoCD, Prometheus
- [authorization.md](authorization.md) — RBAC, zero ingress
- [messaging_async.md](messaging_async.md) — Event queue
