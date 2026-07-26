# Integration

How the operator connects to external APIs and systems.

- **Kubernetes**: Cluster resources, ConfigMap, in-cluster config
- **ArgoCD**: Detection (CRD check, namespace check, deployment verification), periodic refresh (6h default), configuration via environment variables; Application status (M9)
- **Prometheus**: Metrics endpoint (`/metrics`), auto-detection; Endpoint override (M1 planned)
- **In-cluster consumers**: kube9-vscode and kube9-desktop (including the Desktop Pro AI agent) via ConfigMap read and CLI exec (`kubectl exec` → `kube9-operator query …`)

## Child Docs
- [api_contracts.md](api_contracts.md): Extension/Desktop↔operator contracts (ConfigMap read, CLI exec, Assessment API); agent co-consumer of events list and assessments history
- [external_systems.md](external_systems.md): Kubernetes API, ArgoCD detection/configuration, Prometheus metrics, kube9-vscode and kube9-desktop integration
- [authorization.md](authorization.md): RBAC (operator ClusterRole/Role, extension/Desktop user permissions), zero ingress architecture
- [messaging_async.md](messaging_async.md): Event queue (EventRecorder, EventQueueWorker, non-blocking recording)
