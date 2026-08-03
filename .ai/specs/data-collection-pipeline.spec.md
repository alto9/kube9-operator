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
- **Validation:** `CollectionPayloadSchema` is a Zod discriminated union on `type`. `CollectionRepository.insertCollection` rejects type/data mismatch and malformed envelopes (no row written). SQLite `type` stays unconstrained TEXT.
- **Payload catalogs:** Normative `data` shapes for `performance-metrics` and `security-posture` live in `.ai/data/data_model.md` and `.ai/data/serialization.md` (source marker, utilization/ratios bounds, privilegedHost / networkPolicyCoverage / nsaCisRollups, 64 KiB and key-count caps).
- **Durable write:** Sole durable write is `CollectionRepository.insertCollection`. Status `collectionsStoredCount` equals SQLite row count. In-memory LocalStorage is not queryable truth and is off the durable write path.
- **Status:** ConfigMap `collectionStats` remains aggregate-only (`totalSuccessCount`, `totalFailureCount`, `collectionsStoredCount`, `lastSuccessTime`); new types participate in those counters.
- **Config:** Helm `metrics.intervals.*` and matching env interval seconds; optional Prometheus client config for performance only (exact keys / registration gate owned by collector + packaging peers).
- **Trust / deploy:** Zero-ingress default; cluster-internal egress only for optional Prometheus; read-only ClusterRole for Kubernetes API collectors.
- **Peer collector open items:** Degrade-row persistence when Prometheus is absent, PromQL/auth knobs, and security-posture partial-API tick classification remain in `performance-metrics-collector` / `security-posture-collector` and runtime/integration child docs.

## Testing Strategy

- Unit: payload schema accept/reject per type (including mismatch of `type` vs `data`); reject oversized or forbidden security-posture CVE/RBAC bodies; empty query success envelope.
- Unit / integration: durable insert via `CollectionRepository.insertCollection`; `collectionsStoredCount` tracks SQLite count after inserts (not LocalStorage size); LocalStorage store alone does not change durable count or CLI visibility.
- Integration: SQLite insert + `query collections --type performance-metrics|security-posture` round-trip with fixture payloads; status aggregates keep the four required fields when new types succeed/fail.
- Contract / chart: collection Prometheus metric `type` labels stay within the closed five-type set (label wiring may land with packaging peer); Helm interval keys for the two new types remain packaging peer scope.
- Manual / smoke (kind/minikube): deferred to collector shipping issues; pipeline contract issue proves schema + durable write with unit/integration fixtures without requiring live Prometheus.

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
