---
story_id: integrate-detection-on-startup
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: completed
priority: high
estimated_minutes: 20
---

## Objective

Integrate ArgoCD detection into operator startup sequence and initialize status with detection result.

## Context

During operator initialization, we need to run ArgoCD detection once and use the result to initialize the argocd field in OperatorStatus. This runs before the first status update.

## Implementation Steps

1. Locate operator initialization/startup code (likely `src/index.ts` or `src/operator.ts`)
2. Parse ArgoCD configuration from Helm values/env vars:
   ```typescript
   const argoCDConfig: ArgoCDDetectionConfig = {
     autoDetect: process.env.ARGOCD_AUTO_DETECT !== 'false',
     enabled: process.env.ARGOCD_ENABLED === 'true' ? true : undefined,
     namespace: process.env.ARGOCD_NAMESPACE || 'argocd',
     selector: process.env.ARGOCD_SELECTOR || 'app.kubernetes.io/name=argocd-server',
     detectionInterval: parseInt(process.env.ARGOCD_DETECTION_INTERVAL || '6', 10)
   };
   ```
3. Run detection during startup:
   ```typescript
   logger.info("Performing initial ArgoCD detection");
   const argoCDStatus = await detectArgoCDWithTimeout(k8sClient, argoCDConfig);
   ```
4. Store argoCDStatus in operator state for use by status manager
5. Ensure detection completes before first status ConfigMap write
6. Log detection result at INFO level

## Files Affected

- `src/index.ts` (or `src/operator.ts`) - Add startup detection
- `src/status/manager.ts` (or equivalent) - Ensure status includes argocd field

## Acceptance Criteria

- [x] ArgoCD configuration parsed from environment variables
- [x] Environment variables follow Helm values structure
- [x] ARGOCD_AUTO_DETECT defaults to true
- [x] ARGOCD_NAMESPACE defaults to "argocd"
- [x] ARGOCD_SELECTOR defaults to "app.kubernetes.io/name=argocd-server"
- [x] ARGOCD_DETECTION_INTERVAL defaults to 6 hours
- [x] detectArgoCDWithTimeout() called during startup
- [x] Detection completes before first status update
- [x] ArgoCDStatus stored in operator state
- [x] Logging indicates detection is starting and result
- [x] Operator continues if detection fails or times out

## Dependencies

- Story 006 (implement-detect-argocd-function) - Need detectArgoCDWithTimeout()
- Story 002 (extend-operator-status-interface) - Need ArgoCDStatus type

## Notes

- Detection should not block indefinitely (30s timeout)
- Use detectArgoCDWithTimeout() not detectArgoCD() directly
- Environment variable names should match Helm values keys
- Store result in operator state for periodic checks to compare against

