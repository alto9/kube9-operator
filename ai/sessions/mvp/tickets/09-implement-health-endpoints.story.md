---
story_id: implement-health-endpoints
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: pending
priority: medium
estimated_minutes: 20
---

## Objective

Implement HTTP health check endpoints for Kubernetes liveness and readiness probes.

## Context

The operator Deployment needs liveness and readiness probes to ensure the operator is healthy. These are simple HTTP endpoints that return 200 OK when the operator is functioning correctly.

## Implementation Steps

1. Create `src/health/server.ts`

2. Setup Express server on port 8080

3. Implement `GET /healthz` (liveness probe):
   - Check if Kubernetes client is accessible
   - Return 200 "OK" if healthy
   - Return 500 "Not healthy" if not

4. Implement `GET /readyz` (readiness probe):
   - Check if operator is initialized
   - Check if ConfigMap can be written
   - Return 200 "Ready" if ready
   - Return 503 "Not ready" if not

5. Start health server in main index.ts

## Files Affected

- `src/health/server.ts` (create)
- `src/health/checks.ts` (create)
- `src/index.ts` (start health server)

## Acceptance Criteria

- [ ] Server listens on port 8080
- [ ] GET /healthz returns 200 when healthy
- [ ] GET /readyz returns 200 when ready
- [ ] Probes check actual system state
- [ ] Server starts without blocking main thread

## Dependencies

- setup-kubernetes-client

