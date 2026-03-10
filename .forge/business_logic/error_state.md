# Error State

## Health Values
- **healthy**: All systems operational
- **degraded**: Non-critical issues (e.g., storage temporarily unavailable, retrying)
- **unhealthy**: Critical issues (e.g., RBAC failure, config error)

## Extension Behavior
- healthy → enable all tier features
- degraded → show warning, enable fallback
- unhealthy → show error, fall back to basic

## Stale Status
- lastUpdate > 5 minutes → treat as degraded regardless of reported health
