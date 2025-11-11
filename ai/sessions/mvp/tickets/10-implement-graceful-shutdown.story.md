---
story_id: implement-graceful-shutdown
session_id: mvp
feature_id: [status-exposure]
spec_id: [status-api-spec]
model_id: []
status: completed
priority: medium
estimated_minutes: 15
---

## Objective

Implement graceful shutdown handlers for SIGTERM and SIGINT signals.

## Context

When Kubernetes stops a pod, it sends SIGTERM. The operator should gracefully shut down: stop background tasks, update status to unhealthy, and exit cleanly.

## Implementation Steps

1. Create `src/shutdown/handler.ts`

2. Implement `gracefulShutdown()` function:
   - Log shutdown initiated
   - Stop status writer
   - Stop registration manager
   - Update status ConfigMap to "unhealthy" with error "Shutting down"
   - Exit with code 0

3. Register handlers in `src/index.ts`:
   - `process.on('SIGTERM', gracefulShutdown)`
   - `process.on('SIGINT', gracefulShutdown)`

4. Add 5 second timeout for shutdown operations

## Files Affected

- `src/shutdown/handler.ts` (create)
- `src/index.ts` (register shutdown handlers)

## Acceptance Criteria

- [ ] SIGTERM triggers graceful shutdown
- [ ] SIGINT triggers graceful shutdown
- [ ] Status writer is stopped
- [ ] Registration manager is stopped
- [ ] Final status update indicates shutdown
- [ ] Process exits cleanly

## Dependencies

- implement-configmap-writer
- implement-registration-manager

