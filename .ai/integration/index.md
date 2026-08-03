# Integration

How the operator connects to external APIs and systems.

- **Kubernetes**: Cluster resources, ConfigMap, in-cluster config; sole source for security-posture collection aggregates
- **ArgoCD**: Detection (CRD check, namespace check, deployment verification), periodic refresh (6h default), configuration via environment variables; Application status (M9)
- **Prometheus (dual role)**: (1) Operator exposes `/metrics` for inbound scrape; (2) optional outbound HTTP client for performance-metrics collection (Trivy-style opt-in, graceful degrade, no metrics-server fallback)
- **Trivy**: Optional vulnerability path only; not used for security-posture collection
- **In-cluster consumers**: kube9-vscode and kube9-desktop (including the Desktop Pro AI agent) via ConfigMap read and CLI exec (`kubectl exec` → `kube9-operator query …`); progressive enhancement for new collection types (operator owns producer this initiative)

## Child Docs
- [api_contracts.md](api_contracts.md): Extension/Desktop↔operator contracts (ConfigMap read, CLI exec, Assessment API, collections query); agent co-consumer of events list and assessments history
- [external_systems.md](external_systems.md): Kubernetes API, ArgoCD detection/configuration, Prometheus exposition + optional outbound client, Trivy boundary, kube9-vscode and kube9-desktop integration
- [authorization.md](authorization.md): RBAC (operator ClusterRole/Role, extension/Desktop user permissions), zero ingress architecture, optional outbound auth posture
- [messaging_async.md](messaging_async.md): Event queue (EventRecorder, EventQueueWorker, non-blocking recording)
