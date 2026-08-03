# Security posture collector

## Introduction

Always-on in-cluster collector that builds bounded security-posture aggregate snapshots from the Kubernetes API and stores them on the shared data collection pipeline as type `security-posture`. Complements optional Trivy vulnerability scanning and resource-configuration-patterns without duplicating either.

Depends on `data-collection-pipeline`.

## Functional Specification

- Default schedule: `SECURITY_POSTURE_INTERVAL_SECONDS` default `86400` (24h), enforced minimum `3600` (1h), random offset `0–3600` (0–1h). Invalid or below-minimum values fail config load.
- Always registered on `CollectionScheduler` during serve bootstrap (core-collector pattern). No enable flag in v1. Does not depend on Prometheus or Trivy.
- Signal classes v1 (cluster API aggregates only):
  - `privilegedHost` counts (required privileged/hostPath/hostNetwork; optional hostPID/hostIPC)
  - `networkPolicyCoverage` (namespace totals + optional `coverageRatio`)
  - Closed `nsaCisRollups` key set (six keys below)
- Distinct from Trivy (CVE / image vulnerability path unchanged) and from configuration-patterns security-context counts (separate collection type).
- **Deferred / non-goals for v1:** RBAC risk rollups; broader CIS/NSA families beyond the closed key set; Trivy HTTP/CLI reuse; CRDs; phone-home; same-milestone vscode/desktop UX.
- Queryable via `query collections` with `--type security-posture`. Empty successful lists are normal before the first snapshot.
- Partial or total cluster-API failure mid-tick: **omit** a `collections` row; count as **failed**; retry next interval. Do not persist partial snapshots. Do not classify as skipped. Posture failure alone does not flip whole-operator `health` to `unhealthy`, does not promote reserved `degraded`, and does not fail `/readyz`.

## Technical Specification

- **Runtime:** Node.js `>=22`; `CollectionScheduler` + SQLite `collections` + `CollectionPayload`. Sole durable write: `CollectionRepository.insertCollection`.
- **Interval / config:** `SECURITY_POSTURE_INTERVAL_SECONDS` (default `86400`, min `3600`, offset `0–3600`). Helm `metrics.intervals.securityPosture` wiring is packaging peer (`#171`); collector may develop against env directly.
- **Registration / bootstrap:** Always register after the three core collectors; init/register failure is log-and-continue; do not delay `setInitialized(true)` for a posture probe. Same failure path for first and later ticks.
- **Integration / RBAC:** v1 signals derive from already-granted reads on pods, apps workloads, namespaces, and networkpolicies. **No ClusterRole delta** for this locked v1 key set. No Secrets API, no pod exec, no cluster-admin. Chart NetworkPolicy purpose comment update (ai-conformance + posture coverage) is packaging peer (`#171`).
- **Payload `data` (normative catalog in `.ai/data/data_model.md`):**
  - Required identity: `timestamp`, `collectionId`, `clusterId`
  - Required `privilegedHost`: `privilegedContainers`, `hostPathVolumes`, `hostNetworkPods`; optional `hostPIDPods`, `hostIPCPods` (ship in v1 gather)
  - Required `networkPolicyCoverage`: `namespacesTotal`, `namespacesWithNetworkPolicy`; optional `coverageRatio` = `namespacesWithNetworkPolicy / namespacesTotal` in `[0,1]` when `namespacesTotal > 0`; omit when total is 0
  - Required `nsaCisRollups`: object that **must** include exactly these six closed keys (non-negative ints; no other keys in v1):
    - `allowPrivilegeEscalationTrueContainers`
    - `runAsNonRootFalseContainers`
    - `readOnlyRootFilesystemFalseContainers`
    - `capabilitiesNotDroppedAllContainers` (containers whose `capabilities.drop` does not include `ALL`)
    - `automountServiceAccountTokenTruePods`
    - `hostNamespacesPods` (pods with `hostPID` or `hostIPC`; hostNetwork stays under `privilegedHost`)
  - Reject CVE / `vulnerabilities` / RBAC-risk bodies; serialized `data` ≤ 64 KiB
- **Partial / failed tick:** Any required cluster-API list/read failure that prevents a complete schema-valid snapshot → omit row; increment `totalFailureCount` and `kube9_operator_collection_total{type="security-posture",status="failed"}`; log warn; retry next interval.
- **Success tick:** Persist via durable write; increment success counters / `status=success` metrics; participate in aggregate `collectionStats` (`collectionsStoredCount` = SQLite row count).

## Testing Strategy

- Unit: payload validation for `security-posture` against the shared catalog; require all six `nsaCisRollups` keys; reject unknown rollup keys, Trivy CVE bodies, or RBAC-risk blobs; reject `type`/`data` mismatch.
- Unit: partial-API gather path omits insert and records failed metrics (fixture stubs for list failures).
- Integration: successful append from fake/minimal API fixtures; `query collections --type security-posture`; scheduler always registers security posture when core collectors start (no Prometheus/Trivy required).
- Chart (peer `#171`): ClusterRole remains read-only with no posture-driven widen for this key set; NetworkPolicy comment covers posture coverage.
- Manual: kind/minikube shows posture rows after first successful tick without Prometheus or Trivy installed; forced API list failure produces no new row and leaves `/readyz` ready / health healthy.

## References

- `.ai/specs/data-collection-pipeline.spec.md`
- `.ai/business_logic/domain_model.md`
- `.ai/business_logic/user_stories.md`
- `.ai/business_logic/error_handling.md`
- `.ai/data/data_model.md`
- `.ai/data/serialization.md`
- `.ai/integration/external_systems.md`
- `.ai/integration/authorization.md`
- `.ai/operations/security.md`
- `.ai/runtime/configuration.md`
- `.ai/runtime/startup_bootstrap.md`
