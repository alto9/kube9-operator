---
story_id: integration-testing
session_id: mvp
feature_id: [status-exposure, server-registration]
spec_id: [status-api-spec]
model_id: [operator-status]
status: pending
priority: high
estimated_minutes: 30
---

## Objective

Create integration tests that verify the complete operator functionality end-to-end in a test cluster.

## Context

After all components are implemented, we need integration tests to verify the operator works correctly as a complete system.

## Implementation Steps

1. Create `tests/integration/` directory

2. Create test script `tests/integration/test-free-tier.sh`:
   - Deploy operator without API key
   - Wait for pod to be ready
   - Verify status ConfigMap exists
   - Verify status shows mode="operated", tier="free"
   - Verify no Secret exists
   - Clean up

3. Create test script `tests/integration/test-pro-tier.sh`:
   - Deploy operator with mock API key
   - Wait for pod to be ready
   - Verify status ConfigMap exists
   - Verify Secret exists with API key
   - Verify status shows mode="enabled" (registration will fail gracefully)
   - Clean up

4. Create test script `tests/integration/test-status-updates.sh`:
   - Deploy operator
   - Watch ConfigMap for 3 minutes
   - Verify updates happen every ~60 seconds
   - Verify timestamp changes

5. Add npm script: `npm run test:integration`

## Files Affected

- `tests/integration/test-free-tier.sh` (create)
- `tests/integration/test-pro-tier.sh` (create)
- `tests/integration/test-status-updates.sh` (create)
- `tests/integration/helpers.sh` (create)
- `package.json` (add integration test script)

## Acceptance Criteria

- [ ] Free tier test passes
- [ ] Pro tier test passes  
- [ ] Status updates test passes
- [ ] Tests clean up after themselves
- [ ] Tests can run in Kind cluster

## Dependencies

- All previous implementation stories completed
- package-and-test-chart task completed

