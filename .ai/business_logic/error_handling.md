# Error Handling

## Graceful Degradation

### ArgoCD Detection Failures
- **Detection timeout**: 30-second timeout protection (`detectArgoCDWithTimeout()`)
- **Failure behavior**: Returns `detected: false`, logs warning, operator continues normally
- **Implementation**: `src/argocd/detection.ts` - detection failures never crash operator

### ArgoCD Resource-Tree Enrichment Failures (M17)
- **CLI failures**: Structured stderr JSON envelope (`ok: false`, `code`, `message`, optional `details`); exit codes per integration API contract. Success writes raw Argo CD JSON to stdout only.
- **Global capability demotion**: Set `resourceTreeCapable: false` and `resourceTreeLastError: { code, message }` only for cluster-wide problems (missing dedicated token, API unreachable, auth failure, cluster-wide RBAC deny on probe). When Argo CD is not detected, omit capable/error fields.
- **Per-application failures**: `APPLICATION_NOT_FOUND`, per-app RBAC deny, and per-app `TIMEOUT` return CLI errors only; leave `resourceTreeCapable` true when the last probe succeeded.
- **Health**: Operator global `health` stays **healthy** for all resource-tree enrichment failures (CLI or probe).
- **Distinction from detection**: `detected: true` with `resourceTreeCapable: false` is a separate signal from `detected: false`.
- **Implementation**: Resource-tree fetch errors must not crash the operator main loop or block assessments/collections.

### Storage Write Failures
- **Collection storage**: Errors logged, metrics recorded, collection retries on next interval
- **Event storage**: Database write failures logged, events dropped (non-blocking queue)
- **Status ConfigMap writes**: Errors tracked in `lastWriteError`, health may degrade, operator continues
- **Retry behavior**: Collections retry on next scheduled interval (no immediate retry)

### External Endpoint Failures
- **Prometheus unreachable (optional assessment checks)**: Log warning, skip optional checks that depend on Prometheus
- **Prometheus unreachable (performance metrics collector)**: Log warning; that collector tick degrades gracefully (no metrics-server / Kubernetes metrics API fallback). Operator continues; other collectors keep their schedules. Prometheus miss alone does **not** set operator `health` to `unhealthy`, and does **not** promote reserved `degraded` health. Exact tick classification (failed vs skipped vs success-with-unavailable) is under Open implementation decisions.
- **ArgoCD endpoint unreachable**: Detection returns not detected, operator continues
- **Trivy server unreachable**: Detection returns not detected; workload scans are skipped until a server is configured

**Implementation**: All external dependencies wrapped with try-catch, errors logged but never thrown to operator main loop.

### Security posture collection partial failures
- **Partial or failed cluster API reads**: When any required cluster-API list/read for security-posture signals fails mid-tick (including when other reads succeeded), treat the tick as **failed**: omit a `collections` row; increment failure counters / `kube9_operator_collection_total{type="security-posture",status="failed"}`; log warn; retry on the next scheduled interval. Do **not** persist a partial snapshot. Do **not** classify as skipped. Do not crash the operator.
- **Health**: Security-posture failed ticks alone do **not** set `health: unhealthy`, do not promote reserved `degraded` health, and do not fail `/readyz`.
- **Non-overlap**: Trivy unreachable remains the vulnerability-scan path only; it is not a security-posture collector failure mode.

## Per-Check (Assessments)

### Exception Handling
- **Check throws exception**: Caught by `runCheckWithIsolation()`, recorded as `CheckStatus.Error`
- **Error code**: `CHECK_ERROR`
- **Behavior**: Error status persisted, run continues with remaining checks
- **Isolation**: Each check runs in isolated context, exceptions don't affect other checks

### Timeout Handling
- **Default timeout**: 30 seconds (30000ms) per check (`DEFAULT_CHECK_TIMEOUT_MS`)
- **Configurable**: Timeout can be overridden per run via `timeoutMs` in run context
- **Timeout detection**: Promise.race between check execution and timeout promise
- **Timeout result**: Recorded as `CheckStatus.Timeout` with error code `CHECK_TIMEOUT`
- **Behavior**: Timeout status persisted, run continues with remaining checks

**Implementation**: `runCheckWithIsolation()` in `src/assessment/runner.ts` wraps each check with timeout protection and exception handling.

## Per-Run (Assessments)

### Storage Unavailable
- **Storage failure**: Run state set to `failed`, run aborted
- **Behavior**: No partial results persisted if storage unavailable at start
- **Error handling**: Storage errors propagate to run level, prevent run completion

### Partial Results
- **Incomplete checks**: Run state set to `partial` if not all checks completed
- **Error/timeout checks**: Run state may be `partial` if errors/timeouts occurred but some checks succeeded
- **Persistence**: All completed check results persisted before run marked complete
- **Final state calculation**: `computeFinalState()` determines state based on completion counts

**Implementation**: `AssessmentRunner.run()` in `src/assessment/runner.ts` handles run-level errors and computes final state via `computeFinalState()`.

## Retry Mechanisms

### Collection Scheduling
- **Retry behavior**: Failed collections retry on next scheduled interval (no immediate retry)
- **Error handling**: Errors logged, metrics recorded, scheduler continues
- **Implementation**: Collection tasks registered with `CollectionScheduler` (`src/collection/scheduler.ts`), errors caught in task callbacks

## Queryable history for agent and client consumers

### Empty history vs failure
- **Success with zero rows**: Valid outcome when filters match nothing or retained rows have aged out / been removed. Does not change operator `health`. Clients report an evidence gap, not an operator failure.
- **Empty collections query**: Successful `query collections` with zero rows (including a new type filter with no snapshots yet) is the same class as empty history: normal evidence gap, not unhealthy.
- **Operator unhealthy or absent**: Consumers fall back per presence/`error_state.md` (toward basic). Tiered agent tooling that depends on history is gated off; live Kubernetes debugging paths remain independent of operator history.
- **Query / exec / RBAC transport failure**: Distinct from empty history. Surface as consumer-side query failure (integration CLI/exec contracts); do not conflate with "no matching retained rows."
- **Assessment history gaps**: Empty or partial assessment history after a successful query is a normal gap (no time-based retention SLA). Same success-vs-failure distinction as events.

### Non-goals
- No error or recovery path that implies operator-held pod/container logs or pruned-log restoration.
- History query failures must not be framed as cluster-mutation or write failures; query paths remain read-only for agent consumers.

### Open implementation decisions

- **Consumer error copy:** Exact Desktop/vscode strings for empty history vs exec/RBAC failure stay in peer interface contracts; operator BL only distinguishes outcome classes.
- **Performance collector tick classification:** Owned by the performance-metrics collector capability / peer refine (`#169`). Must not invent a new operator `health` value.

### Resolved (security posture partial-failure classification)

When any required cluster-API read for a security-posture tick fails, **omit** the `collections` row and count the tick as **failed** (not skipped, not a partial persisted snapshot). Retry next interval. Health and `/readyz` stay unaffected by posture failure alone. Aligns with performance unavailable omit+failed semantics for durable rows.
