# Domain Model

## Operator presence (extension UX)

| UX mode | Conditions | Extension behavior |
|---------|------------|-------------------|
| basic | No operator installed | kubectl-focused workflows; install prompts when appropriate |
| operated | Operator installed | Reads status ConfigMap, dashboards, assessments, and optional integrations |

**Transitions**: Operator starts → publishes `mode: "operated"` in status JSON. No registration or remote sign-in through this chart.

**Implementation**: Status calculator (`src/status/calculator.ts`) publishes `mode: "operated"` when the operator is running. The extension treats missing status ConfigMap as basic mode.

## Assessment Lifecycle

### Run States
- **queued**: Assessment run requested but not yet started
- **running**: Assessment run in progress, checks executing
- **completed**: All checks finished successfully (may include failures/warnings)
- **failed**: Critical failure preventing run completion (e.g., storage unavailable)
- **partial**: Some checks completed but run incomplete (timeouts, errors, or not all checks finished)

**Implementation**: Defined in `src/assessment/types.ts` as `AssessmentRunState` enum. Final state computed by `computeFinalState()` in `src/assessment/runner.ts` based on check completion counts.

### Check Statuses
- **passing**: Check passed validation
- **failing**: Check failed validation
- **warning**: Check passed with warnings
- **skipped**: Check skipped (not applicable to current context)
- **error**: Check threw exception during execution
- **timeout**: Check exceeded timeout limit (default 30 seconds)

**Implementation**: Defined in `src/assessment/types.ts` as `CheckStatus` enum. Each check runs with isolation and timeout protection (`runCheckWithIsolation()` in `src/assessment/runner.ts`).

### Assessment Modes
- **full**: Execute all registered checks across all pillars
- **pillar**: Execute checks for a specific pillar only (security, reliability, performance, cost, operational excellence, sustainability)
- **single-check**: Execute a single check by ID

**Implementation**: Defined in `src/assessment/types.ts` as `AssessmentRunMode` enum. Check resolution handled by `resolveChecksForRun()` in `src/assessment/runner.ts`.

## Kubernetes AI Conformance Readiness

Kubernetes AI Conformance readiness is a Kube9 evaluation of bundled checklist requirements against observable cluster signals and explicit external-evidence gaps. It complements Well-Architected assessment and does not represent official CNCF certification.

### Checklist Selection

- Select the checklist by cluster Kubernetes minor, using the same cluster metadata path that records Kubernetes version.
- Bundle or sync checklist YAML from the designated `alto9/ai-conformance` source into the operator package.
- Record the selected checklist version and source revision or bundle identifier with each run and in the published summary.
- Selection must be deterministic: the same cluster minor and operator package produce the same checklist version unless the packaged source changes.

### Requirement Outcomes

- **passed**: Kube9 can objectively observe a satisfying cluster signal.
- **failed**: Kube9 can objectively observe a violating cluster signal.
- **warning**: Kube9 observes a partial, advisory, or risk-bearing signal that is not a hard failure.
- **not-applicable**: The requirement does not apply to the current cluster context.
- **not-evaluated**: Kube9 does not have an objective cluster signal for the requirement.
- **needs-evidence**: The requirement depends on user, vendor, policy, or attestation evidence outside Kubernetes API observation.

The evaluator must prefer `not-evaluated` or `needs-evidence` over inference when a requirement cannot be proven from observable data.

### Pillars
- security
- reliability
- performance
- cost
- operational excellence
- sustainability

## Data Collection Categories (M8)

1. **Cluster metadata** (24h default, 3600s minimum)
   - Kubernetes version, cluster identifier, node count, provider, region/zone
   - Collector: `ClusterMetadataCollector` (`src/collection/collectors/cluster-metadata.ts`)

2. **Resource inventory** (6h default, 1800s minimum)
   - Namespace counts (hashed IDs), pod/deployment/statefulset/replicaset/service counts
   - Collector: `ResourceInventoryCollector` (`src/collection/collectors/resource-inventory.ts`)

3. **Resource configuration patterns** (12h default, 3600s minimum)
   - Limits/requests, replica counts, image pull policies, security contexts, probes, volume types, service types
   - Collector: `ResourceConfigurationPatternsCollector` (`src/collection/collectors/resource-configuration-patterns.ts`)

4. **Performance metrics** (15m default, enforced minimum)
   - Bounded aggregate utilization/ratio rollups from optional in-cluster Prometheus (outbound scrape/query)
   - Graceful degrade when Prometheus is absent or unreachable; no metrics-server / Kubernetes metrics API fallback
   - Distinct from operator `/metrics` exposition (inbound scrape of the operator itself)
   - Collector: Performance metrics collector on `CollectionScheduler` (SQLite `collections`; existing collections query CLI)

5. **Security posture** (24h default, enforced minimum)
   - Cluster API aggregates only: privileged/hostPath/hostNetwork-style counts, NetworkPolicy coverage, and basic NSA/CIS-oriented rollups from Kubernetes objects
   - Distinct from resource-configuration-patterns (including its security-context-style pattern counts) and from Trivy image/CVE scanning
   - Non-goals for this category: Trivy CVE duplication, RBAC risk rollups, broader CIS/NSA families beyond the basic rollups above
   - Collector: Security posture collector on `CollectionScheduler` (SQLite `collections`; existing collections query CLI)

**Scheduler and storage**: Intervals configured via Helm values and enforced with minimums. Collections scheduled with random offsets (0-1 hour) matching existing collectors. Persistence stays on the SQLite `collections` path via `CollectionRepository.insertCollection` (sole durable write); no CRDs for these payloads; no phone-home / registration / kube9-api sync. Default intervals for the five categories: 86400s (24h metadata), 21600s (6h inventory), 43200s (12h config patterns), ~900s (15m performance), 86400s (24h security posture). Exact second values and minima for the two newer collectors remain packaging/runtime peer scope under Open implementation decisions.

**Milestone consumer scope**: Operator-owned schedule, status `collectionStats`, and collections query are the user-visible outcomes for these collectors. vscode and Desktop remain progressive-enhancement co-consumers later; this surface does not add presence modes or AssessmentRunState/CheckStatus values.

## Queryable history for agent and client consumers

Paid Desktop products and vscode extensions may **co-consume** the same operator query surfaces for retained **events** and **assessments history**. The operator owns what those histories mean, which filters apply, and the retention outcomes below. Desktop owns debug playbooks, diagnostic report shape, and tool-loop strategy. This path does **not** add a presence mode beyond basic/operated, and does **not** add AssessmentRunState or CheckStatus values.

### User-visible retention outcomes

| History | User-visible promise | Notes |
|---------|----------------------|-------|
| Events | Severity-split defaults: **7** days for info/warning, **30** days for error/critical | Honest advertised window for agent/evidence outcomes that cite Operator history. Knobs and cleanup schedule live in data/runtime contracts. |
| Assessments history | **No** time-based retention SLA in this product surface | **Posture / historical check signal** for agent and vscode consumers (not a live incident log stream). Rows persist until explicit remove or cascade delete of the parent assessment. Consumers may rely only on whatever is still stored. Empty or partial assessment history is a normal gap. |
| Collections | **No** time-based retention SLA (assessments-class) | Snapshot rows for all collection categories, including performance metrics and security posture, persist until explicit remove or operational cleanup. No count-based cap. Consumers may rely only on whatever is still stored. Empty collections query results are a normal gap. |

### Non-goals (agent-consumer path)

- Operator capture, retention, or query of pod/container **logs** (separate product epic; not part of this domain surface)
- Recovery of logs already pruned from the live Kubernetes API
- Any agent or query path that mutates cluster state (apply, patch, delete)

### Consumer documentation

User-facing operator docs (`charts/kube9-operator/README.md`) list **kube9-vscode** and **kube9-desktop** (including Pro AI agent Tier 2 operator query tools) as first-class co-consumers on the ConfigMap read + `kubectl exec` query path. Integration contracts own CLI semantics; README owns operator-facing consumer naming.

## Open implementation decisions

### Resolved (collection type tokens)

Additive kebab-case tokens are `performance-metrics` and `security-posture`. Business logic, data Zod/TS literals, CLI `--type`, and observability `type` labels use the same strings. Do not rename or remove the three shipped type strings.

### Resolved (performance-metrics interval and registration)

Performance-metrics defaults to `900` seconds (minimum `300`, offset `0–300`) via `PERFORMANCE_METRICS_INTERVAL_SECONDS`. Registration is config-gated on non-empty `PROMETHEUS_BASE_URL`. Unavailable Prometheus when registered omits rows and counts failed ticks without blocking ready or other collectors.

### Interval seconds — security-posture peer scope

Exact default seconds and enforced minima for the ~24h security-posture collector remain locked with that collector / packaging peers; product default remains ~24h with random offset matching long-interval peers.
