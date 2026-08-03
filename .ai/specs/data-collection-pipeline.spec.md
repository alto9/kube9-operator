# Data collection pipeline

## Introduction

The kube9-operator data collection pipeline schedules periodic in-cluster collectors, persists append-only snapshots in SQLite `collections`, exposes aggregate `collectionStats` on the operator status ConfigMap, and serves `kube9-operator query collections list|get` for progressive consumers (VS Code / Desktop later). This capability covers the shared pipeline for all collection types, including the completed set: cluster-metadata, resource-inventory, resource-configuration-patterns, performance-metrics, and security-posture.

Related capabilities: `performance-metrics-collector` and `security-posture-collector` specialize the two newest collectors; Trivy image scan and assessment runs are separate optional paths.

## Functional Specification

- Collectors register on the in-process CollectionScheduler with type-specific intervals, enforced minima, and random offsets.
- Successful ticks append a new `collections` row (`collection_id` per snapshot) with a versioned `CollectionPayload` (`version`, `type`, `data`, `sanitization`).
- Operators query history via existing collections CLI filters (`--type`, time window, pagination) and formats (`json|yaml|table|compact`). Empty successful lists are normal (evidence gap), not operator unhealthy.
- Status `collectionStats` remains aggregate counters over stored collections; new types participate without breaking the aggregate field set for progressive peers.
- **Retention:** assessments-class — no time-based TTL and no count-based cap; rows persist until explicit remove or operational cleanup. Consumers rely only on still-stored rows. Disk growth from high-frequency appends is an operational concern.
- **Non-goals for this capability boundary:** phone-home / kube9-api sync; CRDs for collection payloads; multi-cluster federation; same-milestone vscode/desktop consumer UX; metrics-server fallback for performance.

## Technical Specification

- **Runtime:** Node.js `>=22` (package engines); TypeScript operator process; better-sqlite3 for durable store at `{DB_PATH}/kube9.db`.
- **Components:** CollectionScheduler; per-type collectors; CollectionRepository / SQLite `collections` table; Zod `CollectionPayload` validation; status publisher; CLI query path via `kubectl exec`.
- **Type tokens (closed set for this pipeline):** `cluster-metadata`, `resource-inventory`, `resource-configuration-patterns`, `performance-metrics`, `security-posture`.
- **Config:** Helm `metrics.intervals.*` and matching env interval seconds; optional Prometheus client config for performance only.
- **Trust / deploy:** Zero-ingress default; cluster-internal egress only for optional Prometheus; read-only ClusterRole for Kubernetes API collectors.
- Field catalogs, exact env key names, registration gate details, and degrade-row persistence shapes remain open implementation decisions in domain child docs until `/refine-issue`.

## Testing Strategy

- Unit: payload schema accept/reject per type; interval min enforcement; empty query success envelope.
- Integration: scheduler registers expected collectors; SQLite insert + `query collections` round-trip; status aggregates include new types without dropping required fields.
- Contract / chart: Helm values expose interval keys; ClusterRole remains read-only for posture reads; collection Prometheus metric `type` labels stay within the closed set.
- Manual / smoke (kind/minikube): install without Prometheus → operator ready, security-posture rows appear over time, performance absent or gated without failing ready; with Prometheus configured → performance rows appear.

## References

- `.ai/business_logic/domain_model.md`
- `.ai/business_logic/user_stories.md`
- `.ai/business_logic/error_handling.md`
- `.ai/data/data_model.md`
- `.ai/data/consistency.md`
- `.ai/data/serialization.md`
- `.ai/runtime/configuration.md`
- `.ai/runtime/startup_bootstrap.md`
- `.ai/integration/api_contracts.md`
- `.ai/interface/input_handling.md`
- `.ai/operations/observability.md`
- `.ai/specs/performance-metrics-collector.spec.md`
- `.ai/specs/security-posture-collector.spec.md`
