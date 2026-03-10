# Data

How data is modeled, persisted, serialized, and kept consistent.

- **Status**: ConfigMap (kube9-operator-status)
- **Rich data**: SQLite at /data/kube9.db (events, assessments; argocd_apps and collections in M8/M9)
- **Query**: CLI via kubectl exec

## Child Docs
- [data_model.md](data_model.md) — Operator status, collection models, SQLite schema
- [persistence_abstractions.md](persistence_abstractions.md) — Dual storage, PVC
- [serialization.md](serialization.md) — CLI formats, JSON schema
- [consistency.md](consistency.md) — Data lifecycle phases
