# Data

How data is modeled, persisted, serialized, and kept consistent.

- **Status**: ConfigMap (kube9-operator-status)
- **Rich data**: SQLite at `/data/kube9.db` (events, assessments, vulnerability scans, collections, argocd_apps, AI conformance runs)
- **Collections**: Five `CollectionPayload` types on the SQLite `collections` table (no CRDs). Includes `performance-metrics` and `security-posture` alongside the three earlier collectors.
- **Query**: CLI via kubectl exec (`query collections list|get` for collection snapshots)
- **Agent / Desktop history consumers**: Durable events, assessment, and collection rows stay in operator SQLite. Advertised event retention is the severity-split window in [consistency.md](consistency.md) (7 days info/warning, 30 days error/critical). Assessments and collections have no time-based TTL and no count-based cap. Operator does not store pod/workload logs.

## Child Docs
- [data_model.md](data_model.md) — Operator status, collection models, SQLite schema; retention pointers on events, assessments, and collections
- [persistence_abstractions.md](persistence_abstractions.md) — Dual storage, PVC; durable history assumes PVC (emptyDir = ephemeral gap)
- [serialization.md](serialization.md) — CLI formats, JSON schema; collection payload envelopes; query surfaces for history consumers
- [consistency.md](consistency.md) — Retention, agent-consumer reliability bounds, lifecycle phases
