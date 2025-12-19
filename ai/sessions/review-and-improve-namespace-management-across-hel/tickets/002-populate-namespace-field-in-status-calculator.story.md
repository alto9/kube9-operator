---
story_id: populate-namespace-field-in-status-calculator
session_id: review-and-improve-namespace-management-across-hel
feature_id:
  - status-exposure
spec_id:
  - status-api-spec
status: pending
estimated_minutes: 15
---

# Populate namespace field in status calculator

## Objective

Update the `calculateStatus()` function to populate the `namespace` field using the POD_NAMESPACE environment variable with fallback to "kube9-system".

## Context

The OperatorStatus interface now includes a `namespace` field (Story 001). This story implements the logic to populate that field with the actual namespace where the operator is running.

The operator already uses `process.env.POD_NAMESPACE || 'kube9-system'` in the StatusWriter for determining where to write the ConfigMap. We need to include this same value in the status data itself.

## Acceptance Criteria

- [ ] calculateStatus() function includes namespace field in returned OperatorStatus
- [ ] Namespace value uses POD_NAMESPACE environment variable
- [ ] Falls back to "kube9-system" if POD_NAMESPACE is not set
- [ ] All existing tests still pass
- [ ] TypeScript compilation succeeds with no errors

## Files to Modify

- `src/status/calculator.ts` - Add namespace to status object in calculateStatus()

## Implementation Guidance

In the `calculateStatus()` function, add namespace to the status object:

```typescript
// Near the top of the function (around line 8)
const STATUS_NAMESPACE = process.env.POD_NAMESPACE || 'kube9-system';

// In the status object (around line 103-119)
const status: OperatorStatus = {
  mode,
  tier,
  version: OPERATOR_VERSION,
  health,
  lastUpdate: new Date().toISOString(),
  registered: isRegistered,
  apiKeyConfigured: !!config.apiKey,
  error,
  namespace: STATUS_NAMESPACE,  // ADD THIS LINE
  collectionStats: {
    // ... existing code
  },
  argocd: argocdStatus
};
```

## Related Scenarios

From `ai/features/core/status-exposure.feature.md`:
- Scenario: "Operator advertises its namespace in status"
- Scenario: "Namespace defaults to kube9-system"
- Scenario: "Operator works in custom namespace"

## Technical Notes

- Use the same fallback logic as StatusWriter (`process.env.POD_NAMESPACE || 'kube9-system'`)
- This matches the spec in `ai/specs/api/status-api-spec.spec.md` line 132
- The POD_NAMESPACE environment variable is set by Helm via Kubernetes downward API

