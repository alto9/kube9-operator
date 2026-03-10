# Data Model

## Operator Status

Exposed via ConfigMap `kube9-operator-status` in operator namespace.

| Property | Type | Description |
|----------|------|-------------|
| mode | `operated` | Single tier; no server registration |
| tier | `free` | User-facing tier |
| version | string | Semver |
| health | `healthy` \| `degraded` \| `unhealthy` | Current health |
| lastUpdate | string | ISO 8601 timestamp |
| error | string \| null | Error message if unhealthy |
| namespace | string | Operator deployment namespace |

## Collection Models (M8)

**Cluster Metadata** (24h interval): Kubernetes version, cluster identifier, node count, provider, region/zone.

**Resource Inventory** (6h interval): Namespace counts (hashed IDs), pod/deployment/statefulset/replicaset/service counts.

**Resource Configuration Patterns** (12h interval): Limits/requests, replica counts, image pull policies, security contexts, probes, volume types, service types.

## SQLite Tables (at /data/kube9.db)

- **assessments**: Framework assessment results (pillar, check_id, status)
- **assessment_history**: Historical aggregates for trending
- **events**: Event history (event_type, severity, object refs, metadata)
- **argocd_apps**: ArgoCD Application sync/health status (M9)
- **collections**: Raw collection data (M8)

## Event Schema

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | `evt_YYYYMMDD_HHMMSS_<random>` |
| event_type | TEXT | `cluster`, `operator`, `assessment`, `health`, `system` |
| severity | TEXT | `info`, `warning`, `error`, `critical` |
| title | TEXT | Short summary |
| description | TEXT | Optional details |
| object_kind, object_namespace, object_name | TEXT | Kubernetes object reference |
| metadata | TEXT | JSON blob |
| created_at | TEXT | ISO 8601 |
