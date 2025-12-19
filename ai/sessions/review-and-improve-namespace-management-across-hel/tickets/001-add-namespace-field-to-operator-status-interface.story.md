---
story_id: add-namespace-field-to-operator-status-interface
session_id: review-and-improve-namespace-management-across-hel
feature_id:
  - status-exposure
spec_id:
  - status-api-spec
status: completed
estimated_minutes: 10
---

# Add namespace field to OperatorStatus interface

## Objective

Add `namespace` field to the OperatorStatus TypeScript interface to enable dynamic namespace discovery by external consumers (VS Code extension).

## Context

The operator already uses POD_NAMESPACE environment variable and creates status ConfigMaps in the correct namespace. However, the status data itself doesn't include which namespace the operator is running in. This makes it impossible for the VS Code extension to discover the operator's location when installed in custom namespaces.

## Acceptance Criteria

- [ ] OperatorStatus interface in `src/status/types.ts` includes `namespace: string` field
- [ ] Field is documented with JSDoc comment explaining its purpose
- [ ] TypeScript compilation succeeds with no errors

## Files to Modify

- `src/status/types.ts` - Add namespace field to OperatorStatus interface

## Implementation Guidance

Add the namespace field to the OperatorStatus interface after the `error` field and before `clusterId`:

```typescript
/**
 * Namespace where the operator is running
 * Used by external consumers to discover operator location
 * @example "kube9-system"
 */
namespace: string;
```

## Related Scenarios

From `ai/features/core/status-exposure.feature.md`:
- Scenario: "Operator advertises its namespace in status"
- Scenario: "Extension discovers operator namespace dynamically"

## Notes

- This is a pure interface change, no implementation logic needed in this story
- The actual population of this field happens in the calculator story
- Keep field required (not optional) - namespace is always known

