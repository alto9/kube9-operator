# Security posture collector

## Introduction

Always-on in-cluster collector that builds bounded security-posture aggregate snapshots from the Kubernetes API and stores them on the shared data collection pipeline as type `security-posture`. Complements optional Trivy vulnerability scanning and resource-configuration-patterns without duplicating either.

Depends on `data-collection-pipeline`.

## Functional Specification

- Default schedule target ~24 hours with enforced minimum and random offset (exact seconds in runtime open-impl).
- Signal classes v1 (cluster API aggregates only): privileged / hostPath / hostNetwork-style counts; NetworkPolicy coverage; basic NSA/CIS-oriented rollups from Kubernetes objects.
- Distinct from Trivy (CVE / image vulnerability path unchanged) and from configuration-patterns security-context counts (separate collection type).
- **Deferred / non-goals for v1:** RBAC risk rollups; broader CIS/NSA families beyond the basic rollups named above; Trivy HTTP/CLI reuse; CRDs; phone-home; same-milestone vscode/desktop UX.
- Always registered on CollectionScheduler (core-collector pattern) unless an explicit enable flag is later added for symmetry; does not depend on Prometheus.
- Queryable via `query collections` with `--type security-posture`; partial API failures warn and retry next interval without flipping whole-operator unhealthy solely for that reason.

## Technical Specification

- **Runtime:** Node.js `>=22`; CollectionScheduler + SQLite `collections` + `CollectionPayload`.
- **Integration / RBAC:** read-only ClusterRole expansion only for resources still missing for the agreed signal set; chart already grants many workload and NetworkPolicy reads. No Secrets API, no pod exec, no cluster-admin for this collector.
- Field-level counter keys, NSA/CIS rollup catalog, and exact ClusterRole delta vs live chart are open implementation decisions (data / operations / integration).

## Testing Strategy

- Unit: payload validation for `security-posture`; reject Trivy CVE bodies or RBAC-risk blobs if presented as this type.
- Integration: successful append from fake/minimal API fixtures; query by type; scheduler always registers security posture when core collectors start.
- Chart: ClusterRole remains read-only; NetworkPolicy (and any added resources) documented for posture purpose.
- Manual: kind/minikube shows posture rows after first successful tick without Prometheus or Trivy installed.

## References

- `.ai/specs/data-collection-pipeline.spec.md`
- `.ai/business_logic/domain_model.md`
- `.ai/business_logic/user_stories.md`
- `.ai/data/serialization.md`
- `.ai/integration/external_systems.md`
- `.ai/integration/authorization.md`
- `.ai/operations/security.md`
- `.ai/runtime/startup_bootstrap.md`
