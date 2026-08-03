# Capability specs (kube9-operator)

Durable capability-level architecture and behavior specifications. Specs integrate domain contracts; they do not replace `.ai/<domain>/` docs.

| Slug | Title | Purpose | Status |
|------|-------|---------|--------|
| `data-collection-pipeline` | Data collection pipeline | Scheduled in-cluster collectors: persist to SQLite `collections`, expose status `collectionStats`, and serve `query collections` | draft |
| `performance-metrics-collector` | Performance metrics collector | Optional Prometheus-backed aggregate snapshots on the shared collection pipeline | draft |
| `security-posture-collector` | Security posture collector | Kubernetes API aggregate security-posture snapshots on the shared collection pipeline | active |
