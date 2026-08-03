# Error State

## Health Values

### healthy
- All systems operational
- ConfigMap writes succeeding
- No critical errors

### degraded
- Reserved in the status schema for future use; the operator currently reports `healthy` or `unhealthy` from `calculateHealth()`.

### unhealthy
- Critical issues preventing normal operation
- Cannot write to ConfigMap (RBAC failure)
- Configuration errors detected (when surfaced as critical)
- System requires immediate attention

**Implementation**: Health calculated by `calculateHealth()` in `src/status/calculator.ts`:
- `unhealthy`: `!canWriteConfigMap` OR critical config-style errors in `lastError`
- `healthy`: all other cases

## Extension Behavior
- **healthy** → enable operator-backed features, normal operation
- **degraded** → reserved for future operator-side semantics
- **unhealthy** → show error message, fall back to basic mode (kubectl-only)

Empty events, assessments-history, or collections query results do **not** change operator health. Absence of matching retained rows is a consumer evidence gap, not an unhealthy signal (see `error_handling.md`).

Optional performance-metrics Prometheus miss and security-posture collection partial or failed ticks do **not** alone set `health` to `unhealthy`, and do **not** promote reserved `degraded`. Those outcomes stay collection/integration degrade classes (see `error_handling.md`).

## Stale Status
- **Threshold**: `lastUpdate > 5 minutes` → treat as degraded regardless of reported health
- **Rationale**: If status hasn't updated in 5+ minutes, operator may be down or unhealthy
- **Extension logic**: Extension checks `lastUpdate` timestamp and compares to current time
- **Status update interval**: 60 seconds (configurable), so 5-minute threshold allows for ~4 missed updates before considering stale

**Implementation**: Status written every 60 seconds by `StatusWriter` (`src/status/writer.ts`). Stale detection logic implemented in extension (not operator-side).
