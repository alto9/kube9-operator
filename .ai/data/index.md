# Data

How data is modeled, persisted, serialized, and kept consistent.

- **Status**: ConfigMap (kube9-operator-status)
- **Rich data**: SQLite at /data/kube9.db (events, assessments; vulnerability scans; collections table specified in M8 — [issue #53](https://github.com/alto9/kube9-operator/issues/53); argocd_apps planned)
- **Query**: CLI via kubectl exec
- **Agent / Desktop history consumers**: Durable events and assessment rows stay in operator SQLite. Advertised event retention for those consumers is the severity-split window in [consistency.md](consistency.md) (7 days info/warning, 30 days error/critical). Assessments have no time-based TTL. Operator does not store pod/workload logs.

## Child Docs
- [data_model.md](data_model.md) — Operator status, collection models, SQLite schema; agent-consumer retention pointers on events and assessments
- [persistence_abstractions.md](persistence_abstractions.md) — Dual storage, PVC; durable history assumes PVC (emptyDir = ephemeral gap)
- [serialization.md](serialization.md) — CLI formats, JSON schema; query surfaces for history consumers
- [consistency.md](consistency.md) — Retention, agent-consumer reliability bounds, lifecycle phases
