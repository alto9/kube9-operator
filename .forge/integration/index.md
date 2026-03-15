# Integration

How the operator connects to external APIs and systems.

- **Kubernetes**: Cluster resources, ConfigMap, in-cluster config
- **ArgoCD**: Detection (CRD check, namespace check, deployment verification), periodic refresh (6h default), configuration via environment variables; Application status (M9)
- **Prometheus**: Metrics endpoint (`/metrics`), auto-detection; Endpoint override (M1 planned)
- **kube9-vscode**: Primary consumer via ConfigMap read and CLI exec

## Child Docs
- [api_contracts.md](api_contracts.md) — Extension↔operator contracts (ConfigMap read, CLI exec, Assessment API)
- [external_systems.md](external_systems.md) — Kubernetes API, ArgoCD detection/configuration, Prometheus metrics, kube9-vscode integration
- [authorization.md](authorization.md) — RBAC (operator ClusterRole/Role, extension user permissions), zero ingress architecture
- [messaging_async.md](messaging_async.md) — Event queue (EventRecorder, EventQueueWorker, non-blocking recording)
