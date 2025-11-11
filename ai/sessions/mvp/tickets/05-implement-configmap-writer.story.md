---
story_id: implement-configmap-writer
session_id: mvp
feature_id: [status-exposure]
spec_id: [status-api-spec]
model_id: [operator-status]
status: completed
priority: high
estimated_minutes: 30
---

## Objective

Implement the ConfigMap writer that periodically writes operator status to the `kube9-operator-status` ConfigMap.

## Context

The primary way the operator exposes status is through a ConfigMap that the VS Code extension reads. This ConfigMap must be updated every 60 seconds with current status.

## Implementation Steps

1. Create `src/status/writer.ts`

2. Implement `createOrUpdateConfigMap()` function:
   - Create ConfigMap object with proper labels
   - JSON.stringify the status object
   - Try to read existing ConfigMap
   - If exists: replace (update)
   - If not exists: create
   - Handle errors gracefully

3. Implement `StatusWriter` class:
   - Constructor takes interval in seconds
   - `start()` method sets up setInterval
   - `stop()` method clears interval
   - Calls status calculator and ConfigMap writer on each tick

4. Add proper error handling and logging

5. Use ConfigMap name: `kube9-operator-status`
6. Use namespace: `kube9-system`

## Files Affected

- `src/status/writer.ts` (create)
- `src/index.ts` (start status writer)

## Acceptance Criteria

- [ ] ConfigMap is created if it doesn't exist
- [ ] ConfigMap is updated if it exists
- [ ] Status is written every 60 seconds
- [ ] Errors don't crash the operator
- [ ] ConfigMap has proper labels
- [ ] JSON in ConfigMap is valid

## Dependencies

- implement-status-calculator
- setup-kubernetes-client

