# Data

How data is modeled, persisted, serialized, and kept consistent.

- **Status**: ConfigMap (kube9-operator-status)
- **Rich data**: SQLite at /data/kube9.db (events, assessments; vulnerability scans; collections table specified in M8 — [issue #53](https://github.com/alto9/kube9-operator/issues/53); argocd_apps planned)
- **Query**: CLI via kubectl exec

## Child Docs
- [data_model.md](data_model.md) — Operator status, collection models, SQLite schema
- [persistence_abstractions.md](persistence_abstractions.md) — Dual storage, PVC
- [serialization.md](serialization.md) — CLI formats, JSON schema
- [consistency.md](consistency.md) — Data lifecycle phases
