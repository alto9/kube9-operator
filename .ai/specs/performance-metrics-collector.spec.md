# Performance metrics collector

## Introduction

Optional in-cluster collector that builds bounded performance aggregate snapshots from Prometheus and stores them on the shared data collection pipeline as type `performance-metrics`. Differentiates kube9-operator from Prometheus Operator by consuming metrics for Well-Architected / cluster insights rather than operating a metrics stack.

Depends on `data-collection-pipeline`. Does not replace operator `/metrics` exposition (inbound scrape by Prometheus remains separate).

## Functional Specification

- Default schedule: `PERFORMANCE_METRICS_INTERVAL_SECONDS` default `900` (15 minutes), enforced minimum `300` (5 minutes), random offset `0–300`. Invalid or below-minimum values fail config load.
- Data source v1: in-cluster Prometheus PromQL HTTP instant queries only (`/api/v1/query` class). No metrics-server / Kubernetes metrics API fallback. Direct target scrape is out of scope for v1.
- Opt-in / degrade: register performance ticks only when `PROMETHEUS_BASE_URL` is non-empty (no separate enable flag). When Prometheus is absent or unreachable, omit a row, count failed, retry next interval; other collectors and readiness continue; operator health does not become unhealthy solely for that reason. Do not persist `source.available: false` marker rows.
- Persisted payload class: bounded utilization / ratio style aggregates inside `CollectionPayload`, not a raw time-series warehouse. Success rows set `source.available: true`.
- Queryable via `query collections` with `--type performance-metrics`; empty list before first success is normal.
- **Non-goals:** installing Prometheus/Prometheus Operator; phone-home; peer UX this milestone; storing unsanitized high-cardinality series dumps; required bearer/existingSecret; required `status.prometheus` block.

## Technical Specification

- **Runtime:** Node.js `>=22`; same CollectionScheduler and SQLite path as peer collectors.
- **Interval / config:** `PERFORMANCE_METRICS_INTERVAL_SECONDS` (default `900`, min `300`, offset `0–300`). Helm `metrics.intervals.performanceMetrics` wiring is packaging peer.
- **Prometheus client env:** `PROMETHEUS_BASE_URL`, `PROMETHEUS_TIMEOUT_MS` (default `30000`, min `1000`), `PROMETHEUS_TLS_INSECURE` (default `false`). Helm top-level `prometheus.baseUrl` / `timeoutMs` / `tlsInsecure` (packaging). Malformed URL or invalid timeout when set → fail config load. Unset URL is soft miss.
- **Auth:** v1 URL + timeout + TLS only. Never send the operator ServiceAccount token as an implicit Prometheus credential. No Secret mount in v1.
- **Registration:** Config-gated on non-empty base URL. Bootstrap must not probe Prometheus before ready; init/register failures log-and-continue.
- **Payload accept shape:** Normative `performance-metrics` `data` catalog (including required `source.available`) is defined in `.ai/data/data_model.md` / serialization; this collector fills those fields on successful ticks.
- **Unavailable path:** omit row + `status=failed` on `kube9_operator_collection_total` / `totalFailureCount`; health and `/readyz` unchanged.

## Testing Strategy

- Unit: payload validation for `performance-metrics` against the shared catalog; config reject for invalid Prometheus URL / timeout when set; config-gated registration.
- Integration: with Prometheus unset → collector not registered; `/readyz` stays ready; with mock Prometheus → successful append + query by type; unreachable/empty mock → no row + failed metrics.
- Chart / ops (packaging peer): `prometheus.*` and interval keys documented; zero-ingress unchanged; default install Ready without Prometheus; metric `type=performance-metrics` on collection series when ticks run.
- Manual: kind/minikube without Prometheus proves graceful degrade; with in-cluster Prometheus proves snapshot queryability.

## References

- `.ai/specs/data-collection-pipeline.spec.md`
- `.ai/integration/external_systems.md`
- `.ai/runtime/configuration.md`
- `.ai/runtime/startup_bootstrap.md`
- `.ai/data/serialization.md`
- `.ai/business_logic/error_handling.md`
- `.ai/operations/build_packaging.md`
- `.ai/vision.json` (primary competitor: Prometheus Operator)
