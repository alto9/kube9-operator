# Error Handling

## Graceful Degradation

### ArgoCD Detection Failures
- **Detection timeout**: 30-second timeout protection (`detectArgoCDWithTimeout()`)
- **Failure behavior**: Returns `detected: false`, logs warning, operator continues normally
- **Implementation**: `src/argocd/detection.ts` - detection failures never crash operator

### Storage Write Failures
- **Collection storage**: Errors logged, metrics recorded, collection retries on next interval
- **Event storage**: Database write failures logged, events dropped (non-blocking queue)
- **Status ConfigMap writes**: Errors tracked in `lastWriteError`, health may degrade, operator continues
- **Retry behavior**: Collections retry on next scheduled interval (no immediate retry)

### External Endpoint Failures
- **Prometheus unreachable**: Log warning, skip optional checks that depend on Prometheus
- **ArgoCD endpoint unreachable**: Detection returns not detected, operator continues
- **kube9-server unreachable** (pro tier): Transmission failures logged, collections stored locally

**Implementation**: All external dependencies wrapped with try-catch, errors logged but never thrown to operator main loop.

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

### Collection Transmission (Pro Tier)
- **Max retries**: 3 attempts
- **Backoff delays**: Exponential (1s, 2s, 4s)
- **Retry conditions**: Network errors, timeouts, server errors (5xx)
- **Final failure**: Logged, graceful degradation (collections stored locally)
- **Implementation**: `TransmissionClient.transmit()` in `src/collection/transmission.ts`

### Registration (Pro Tier)
- **Max retries**: 3 attempts
- **Backoff delays**: Exponential (1s, 2s, 4s)
- **Retry conditions**: Network errors, server errors, timeouts
- **State tracking**: Consecutive failures tracked, health degrades after 3+ failures
- **Implementation**: `RegistrationManager.handleRegistrationError()` in `src/registration/manager.ts`

### Collection Scheduling
- **Retry behavior**: Failed collections retry on next scheduled interval (no immediate retry)
- **Error handling**: Errors logged, metrics recorded, scheduler continues
- **Implementation**: Collection tasks registered with `CollectionScheduler` (`src/collection/scheduler.ts`), errors caught in task callbacks
