---
story_id: extend-operator-status-interface
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: pending
priority: high
estimated_minutes: 10
---

## Objective

Extend the OperatorStatus TypeScript interface to include ArgoCD awareness fields.

## Context

The OperatorStatus interface defines the structure of status data exposed via ConfigMap. We need to add a new `argocd` field to track ArgoCD detection state.

## Implementation Steps

1. Locate the OperatorStatus interface (likely in `src/types/` or `src/status/`)
2. Add new `argocd` field to the interface:
   ```typescript
   interface OperatorStatus {
     // ... existing fields (mode, tier, version, health, etc.)
     
     // ArgoCD awareness information
     argocd: {
       // Whether ArgoCD is detected in the cluster
       detected: boolean;
       
       // Namespace where ArgoCD is installed (null if not detected)
       namespace: string | null;
       
       // ArgoCD version (null if not detected or version unavailable)
       version: string | null;
       
       // ISO 8601 timestamp of last detection check
       lastChecked: string;
     };
   }
   ```
3. If there's a type for the argocd nested object, create it:
   ```typescript
   interface ArgoCDStatus {
     detected: boolean;
     namespace: string | null;
     version: string | null;
     lastChecked: string;
   }
   ```

## Files Affected

- `src/types/operator-status.ts` (or equivalent) - Extend OperatorStatus interface

## Acceptance Criteria

- [ ] OperatorStatus interface includes argocd field
- [ ] ArgoCDStatus interface is properly typed
- [ ] All fields use correct TypeScript types (boolean, string | null, string)
- [ ] Interface follows existing code style and conventions
- [ ] TypeScript compilation succeeds without errors

## Dependencies

- Story 001 (add-argocd-helm-config) - Ensures configuration exists

## Notes

- Keep naming consistent with existing status fields
- Use ISO 8601 string format for lastChecked timestamp
- Nullable fields (namespace, version) use `string | null`, not `string?`

