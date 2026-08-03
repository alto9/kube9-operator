# Performance metrics collector

## Introduction

Optional in-cluster collector that builds bounded performance aggregate snapshots from Prometheus and stores them on the shared data collection pipeline as type `performance-metrics`. Differentiates kube9-operator from Prometheus Operator by consuming metrics for Well-Architected / cluster insights rather than operating a metrics stack.

Depends on `data-collection-pipeline`. Does not replace operator `/metrics` exposition (inbound scrape by Prometheus remains separate).

## Functional Specification

- Default schedule target ~15 minutes with enforced minimum and random offset (exact seconds in runtime open-impl).
- Data source v1: in-cluster Prometheus only (optional outbound HTTP query and/or scrape). No metrics-server / Kubernetes metrics API fallback.
- Opt-in / degrade: no performance pull until Prometheus endpoint is configured (recommended: config-gated registration). When Prometheus is absent or unreachable, other collectors and readiness continue; operator health does not become unhealthy solely for that reason.
- Persisted payload class: bounded utilization / ratio style aggregates inside `CollectionPayload`, not a raw time-series warehouse.
- Queryable via `query collections` with `--type performance-metrics`; empty list before first success is normal.
- **Non-goals:** installing Prometheus/Prometheus Operator; phone-home; peer UX this milestone; storing unsanitized high-cardinality series dumps.

## Technical Specification

- **Runtime:** Node.js `>=22`; same CollectionScheduler and SQLite path as peer collectors.
- **Integration:** Trivy-style optional outbound client; cluster-internal egress; prefer not using the operator ServiceAccount token as an implicit Prometheus credential.
- **Recommended registration:** register performance ticks only when a Prometheus base URL (or equivalent enable+URL) is set; unset is soft miss, not config failure.
- **Payload accept shape:** Normative `performance-metrics` `data` catalog (including required `source.available`) is defined in `.ai/data/data_model.md` / serialization; this collector fills those fields on ticks.
- Exact PromQL vs scrape shape, auth/TLS knobs, timeouts, and whether unavailable ticks omit rows vs store `source.available: false` remain open implementation decisions (integration / runtime / error_handling).

## Testing Strategy

- Unit: payload validation for `performance-metrics` against the shared catalog; config reject for invalid Prometheus URL when set.
- Integration: with Prometheus unset → collector not registered or no failing ticks; `/readyz` stays ready; with mock Prometheus → successful append + query by type.
- Chart / ops: optional Prometheus values documented; zero-ingress unchanged; metric `type=performance-metrics` appears only on collection series when ticks run.
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
