---
story_id: implement-status-calculator
session_id: mvp
feature_id: [status-exposure]
spec_id: [status-api-spec]
model_id: [operator-status]
status: pending
priority: high
estimated_minutes: 25
---

## Objective

Implement status calculation logic that determines the operator's current mode, tier, and health status.

## Context

The status calculator is the core logic that determines what status to expose to the extension. It needs to accurately reflect the operator's state based on configuration and registration status.

## Implementation Steps

1. Create `src/status/calculator.ts`

2. Create `OperatorStatus` interface matching model:
   ```typescript
   interface OperatorStatus {
     mode: "operated" | "enabled";
     tier: "free" | "pro";
     version: string;
     health: "healthy" | "degraded" | "unhealthy";
     lastUpdate: string;
     registered: boolean;
     error: string | null;
     clusterId?: string;
   }
   ```

3. Implement `calculateStatus()` function that:
   - Returns "operated" mode if no API key
   - Returns "enabled" mode if API key present
   - Sets tier based on registration status
   - Calculates health based on system state
   - Includes current timestamp
   - Never includes sensitive data

4. Implement health logic:
   - `healthy`: All systems operational
   - `degraded`: API key present but not registered
   - `unhealthy`: Critical errors (can't write ConfigMap)

## Files Affected

- `src/status/calculator.ts` (create)
- `src/status/types.ts` (create)

## Acceptance Criteria

- [ ] Status correctly shows "operated" without API key
- [ ] Status correctly shows "enabled" with API key
- [ ] Health calculation is accurate
- [ ] Timestamp is ISO 8601 format
- [ ] No sensitive data in status object

## Dependencies

- implement-config-loader

