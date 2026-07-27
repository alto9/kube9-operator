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

4. Performance metrics (future, 15min)
5. Security posture (future, 24h)

**Implementation**: Intervals configured via Helm values (`charts/kube9-operator/values.yaml`) and enforced with minimums. Collections scheduled with random offsets (0-1 hour) to distribute load. Default intervals: 86400s (24h), 21600s (6h), 43200s (12h).

## Queryable history for agent and client consumers

Paid Desktop products and vscode extensions may **co-consume** the same operator query surfaces for retained **events** and **assessments history**. The operator owns what those histories mean, which filters apply, and the retention outcomes below. Desktop owns debug playbooks, diagnostic report shape, and tool-loop strategy. This path does **not** add a presence mode beyond basic/operated, and does **not** add AssessmentRunState or CheckStatus values.

### User-visible retention outcomes

| History | User-visible promise | Notes |
|---------|----------------------|-------|
| Events | Severity-split defaults: **7** days for info/warning, **30** days for error/critical | Honest advertised window for agent/evidence outcomes that cite Operator history. Knobs and cleanup schedule live in data/runtime contracts. |
| Assessments history | **No** time-based retention SLA in this product surface | Rows persist until explicit remove or cascade delete of the parent assessment. Consumers may rely only on whatever is still stored. Empty or partial assessment history is a normal gap. |

### Non-goals (agent-consumer path)

- Operator capture, retention, or query of pod/container **logs** (separate product epic; not part of this domain surface)
- Recovery of logs already pruned from the live Kubernetes API
- Any agent or query path that mutates cluster state (apply, patch, delete)

### Consumer documentation

User-facing operator docs (`charts/kube9-operator/README.md`) list **kube9-vscode** and **kube9-desktop** (including Pro AI agent Tier 2 operator query tools) as first-class co-consumers on the ConfigMap read + `kubectl exec` query path. Integration contracts own CLI semantics; README owns operator-facing consumer naming.
