---
story_id: add-argocd-status-to-configmap
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: completed
priority: high
estimated_minutes: 15
---

## Objective

Update the status manager to include argocd field when writing OperatorStatus to ConfigMap.

## Context

The status manager writes OperatorStatus to a ConfigMap every 60 seconds. We need to ensure the argocd field is included in the JSON payload.

## Implementation Steps

1. Locate status manager code (likely `src/status/manager.ts` or similar)
2. Find the code that constructs OperatorStatus object
3. Add argocd field to status object:
   ```typescript
   const status: OperatorStatus = {
     mode: config.apiKey ? "enabled" : "operated",
     tier: config.apiKey && registered ? "pro" : "free",
     version: OPERATOR_VERSION,
     health: calculateHealth(),
     lastUpdate: new Date().toISOString(),
     registered: registrationState.isRegistered,
     error: lastError || null,
     clusterId: registrationState.clusterId || undefined,
     // Add ArgoCD status
     argocd: this.argoCDStatus  // From operator state
   };
   ```
4. Ensure argocd status is included in ConfigMap data JSON
5. Verify ConfigMap serialization handles null values correctly

## Files Affected

- `src/status/manager.ts` (or equivalent) - Add argocd to OperatorStatus construction

## Acceptance Criteria

- [x] OperatorStatus includes argocd field
- [x] ArgoCD status uses current detection result from operator state
- [x] ConfigMap JSON includes argocd object with all fields
- [x] Null values (namespace, version) serialize correctly in JSON
- [x] Status update every 60 seconds includes argocd
- [x] VS Code extension can read argocd from ConfigMap (operator side complete; extension update is separate)
- [x] TypeScript compiles without errors

## Dependencies

- Story 007 (integrate-detection-on-startup) - Need argocd status in operator state
- Story 002 (extend-operator-status-interface) - Need OperatorStatus type updated

## Notes

- ArgoCD status should be included even if detected: false
- Ensure JSON.stringify handles the argocd object correctly
- Test that VS Code extension can parse the new status format

