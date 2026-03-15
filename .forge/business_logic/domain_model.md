# Domain Model

## Tier Modes

| Mode | Tier | Conditions | Extension Behavior |
|------|------|------------|-------------------|
| basic | — | No operator installed | kubectl-only, limited features |
| operated | free | Operator installed | Local webviews, status via ConfigMap |

**Transitions**: Operator starts → operated. No registration or server communication.

**Implementation**: Status calculator (`src/status/calculator.ts`) always returns `mode: "operated"` and `tier: "free"` when operator is running. The "basic" mode is detected by the extension when the ConfigMap is not found.

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
