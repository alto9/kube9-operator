# Performance metrics collector

## Introduction

Optional in-cluster collector that builds bounded performance aggregate snapshots from Prometheus and stores them on the shared data collection pipeline as type `performance-metrics`. Differentiates kube9-operator from Prometheus Operator by consuming metrics for Well-Architected / cluster insights rather than operating a metrics stack.

Depends on `data-collection-pipeline`. Does not replace operator `/metrics` exposition (inbound scrape by Prometheus remains separate).

## Functional Specification

- Default schedule: `900` seconds (15 minutes), enforced minimum `300` seconds (5 minutes), random offset `0–300` seconds.
- Data source v1: in-cluster Prometheus only via optional outbound **PromQL HTTP API** (`/api/v1/query` class). No metrics-server / Kubernetes metrics API fallback. Direct target scrape is out of v1.
- **Config-gated registration:** register on `CollectionScheduler` only when `PROMETHEUS_BASE_URL` is non-empty. Unset URL is a soft miss (no ticks, not config failure). No separate enable flag in v1.
- When registered and Prometheus is unreachable, auth-failed, timed out, or returns unusable/empty results: **omit** a `collections` row; count the tick as **failed** on collection metrics / `totalFailureCount`; do not persist `source.available: false` marker rows; do not classify as skipped. Operator `/readyz` and other collectors continue; Prometheus miss alone does not set `health: unhealthy` or reserved `health: degraded`.
- Successful ticks persist bounded utilization aggregates via `CollectionRepository.insertCollection` with catalog `source.available: true` (optional utilization / ratios fields).
- Queryable via `query collections` with `--type performance-metrics`; empty list before first success is a normal evidence gap.
- **Non-goals:** installing Prometheus/Prometheus Operator; phone-home; peer UX this milestone; storing unsanitized high-cardinality series dumps; required `status.prometheus` block; SA token as implicit Prometheus credential.

## Technical Specification

- **Runtime:** Node.js `>=22`; same `CollectionScheduler` and SQLite path as peer collectors.
- **Interval env:** `PERFORMANCE_METRICS_INTERVAL_SECONDS` (default `900`, minimum `300`, random offset `0–300`). Invalid or below-minimum values fail config load. Helm mapping `metrics.intervals.performanceMetrics` is packaging peer (#171).
- **Prometheus outbound env (runtime contract):**
  - `PROMETHEUS_BASE_URL` — non-empty registers the collector; unset → no register / no fail load; malformed when set → fail config load.
  - `PROMETHEUS_TIMEOUT_MS` — default `30000`, minimum `1000`; invalid → fail config load.
  - `PROMETHEUS_TLS_INSECURE` — default `false`.
  - v1 ships URL + timeout + TLS only (no bearer/basic/existingSecret required for collector accept). Never send the operator ServiceAccount token as an implicit Prometheus credential. Optional auth mount is packaging backlog (#171 / later).
- **Call shape:** PromQL instant queries against `{PROMETHEUS_BASE_URL}/api/v1/query` (or equivalent instant-query path on that base). Map successful numeric results into the normative `performance-metrics` `data` catalog in `.ai/data/data_model.md`:
  - Required on success: identity fields (`timestamp`, `collectionId`, `clusterId`) and `source: { available: true }` (optional `reason` unused on success).
  - Optional when PromQL supplies them: `utilization.cpu.clusterAvgRatio`, `utilization.cpu.nodeHighWatermarkRatio`, `utilization.memory.clusterAvgRatio`, `utilization.memory.nodeHighWatermarkRatio` (each in `[0, 1]`).
  - Optional `ratios` map may be omitted in v1 (or filled only with a small allowlisted set of named ratios in `[0, 1]`, ≤16 keys).
  - Reject raw series dumps / unbounded label maps / serialized `data` > 64 KiB at write validation.
- **Unavailable / unusable tick:** unreachable, auth-failed, timeout, empty vector, or results that cannot yield a valid catalog payload → log warn, **no** `collections` row, increment `kube9_operator_collection_total{type="performance-metrics",status="failed"}` and `totalFailureCount`, retry next interval. Do not use `source.available: false` success rows for this path.
- **Success tick:** insert via `CollectionRepository.insertCollection`; increment success counters; participate in aggregate `collectionStats`.
- **Bootstrap:** same degrade path for first and later ticks; do not probe Prometheus before `setInitialized(true)`; register after core collectors when URL gate passes; init failure log-and-continue.
- **Status:** no required bounded `status.prometheus` block for this capability.
- **Chart ownership:** Helm values tree and Deployment env wiring for the keys above are owned by packaging peer (#171); this capability owns runtime semantics and validation.

## Testing Strategy

- Unit: payload validation for successful `performance-metrics` fixtures (`source.available: true`, utilization bounds); config reject for malformed `PROMETHEUS_BASE_URL` or invalid timeout when set; config accept when URL unset (collector not registered).
- Unit: mock PromQL client — success maps into catalog fields and calls `CollectionRepository.insertCollection`; unreachable / timeout / empty → no insert, failed metric path.
- Integration: Prometheus unset → no performance ticks / no failing ready; `/readyz` ready; other collectors unaffected. Mock Prometheus → successful append + `query collections --type performance-metrics` returns the row.
- Integration: registered URL + failing mock → no row, `totalFailureCount` / collection `status=failed` increments, operator health stays healthy, `/readyz` ready.
- Chart / ops (peer #171): optional Prometheus values documented; zero-ingress unchanged; `type=performance-metrics` on collection series when ticks run.
- Manual: kind/minikube without Prometheus URL proves no registration / ready; with in-cluster Prometheus URL proves snapshot queryability.

## References

- `.ai/specs/data-collection-pipeline.spec.md`
- `.ai/integration/external_systems.md`
- `.ai/runtime/configuration.md`
- `.ai/runtime/startup_bootstrap.md`
- `.ai/data/data_model.md`
- `.ai/data/serialization.md`
- `.ai/business_logic/error_handling.md`
- `.ai/operations/build_packaging.md`
- `.ai/operations/observability.md`
- `.ai/vision.json` (primary competitor: Prometheus Operator)
