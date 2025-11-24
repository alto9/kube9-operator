---
story_id: implement-detect-argocd-function
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
diagram_id: [argocd-detection-flow]
status: completed
priority: high
estimated_minutes: 25
---

## Objective

Implement the main detectArgoCD() function that orchestrates detection logic based on configuration precedence.

## Context

This is the main entry point for ArgoCD detection. It implements the configuration precedence rules (enabled > autoDetect > default) and coordinates calls to checkForApplicationCRD() and detectInNamespace().

## Implementation Steps

1. Add to `src/argocd/detection.ts`
2. Implement detectArgoCD() with configuration precedence:
   ```typescript
   export async function detectArgoCD(
     k8sClient: KubernetesClient,
     config: ArgoCDDetectionConfig
   ): Promise<ArgoCDStatus> {
     const now = new Date().toISOString();
     
     // Check 1: Is detection disabled?
     if (config.enabled === false || config.autoDetect === false) {
       logger.debug("ArgoCD detection disabled via configuration");
       return {
         detected: false,
         namespace: null,
         version: null,
         lastChecked: now
       };
     }
     
     // Check 2: Is ArgoCD explicitly enabled?
     if (config.enabled === true) {
       logger.debug("ArgoCD explicitly enabled, bypassing CRD check");
       return await detectInNamespace(
         k8sClient,
         config.namespace || "argocd",
         config.selector || "app.kubernetes.io/name=argocd-server",
         now
       );
     }
     
     // Check 3: Auto-detect with CRD check
     logger.debug("Checking for ArgoCD Application CRD");
     const hasCRD = await checkForApplicationCRD(k8sClient);
     if (!hasCRD) {
       logger.info("ArgoCD not detected in cluster (no Application CRD)");
       return {
         detected: false,
         namespace: null,
         version: null,
         lastChecked: now
       };
     }
     
     // Check 4: Verify deployment in namespace
     logger.debug("Application CRD found, checking for ArgoCD deployment");
     const result = await detectInNamespace(
       k8sClient,
       config.namespace || "argocd",
       config.selector || "app.kubernetes.io/name=argocd-server",
       now
     );
     
     if (result.detected) {
       logger.info("ArgoCD detected", {
         namespace: result.namespace,
         version: result.version
       });
     } else {
       logger.info("ArgoCD not detected in cluster");
     }
     
     return result;
   }
   ```
3. Add timeout wrapper:
   ```typescript
   export async function detectArgoCDWithTimeout(
     k8sClient: KubernetesClient,
     config: ArgoCDDetectionConfig,
     timeoutMs: number = 30000
   ): Promise<ArgoCDStatus> {
     const timeoutPromise = new Promise<ArgoCDStatus>((resolve) => {
       setTimeout(() => {
         logger.warn("ArgoCD detection timed out", { timeoutMs });
         resolve({
           detected: false,
           namespace: null,
           version: null,
           lastChecked: new Date().toISOString()
         });
       }, timeoutMs);
     });
     
     return Promise.race([
       detectArgoCD(k8sClient, config),
       timeoutPromise
     ]);
   }
   ```

## Files Affected

- `src/argocd/detection.ts` - Add detectArgoCD() and detectArgoCDWithTimeout()

## Acceptance Criteria

- [ ] detectArgoCD() implements correct configuration precedence
- [ ] enabled: false bypasses all detection
- [ ] autoDetect: false bypasses all detection
- [ ] enabled: true skips CRD check and goes directly to namespace
- [ ] Default behavior checks CRD then namespace
- [ ] Logging at INFO level for detection results
- [ ] Logging at DEBUG level for intermediate steps
- [ ] detectArgoCDWithTimeout() races detection against timeout
- [ ] Timeout defaults to 30 seconds
- [ ] Timeout returns detected: false with warning log
- [ ] All branches return proper ArgoCDStatus structure
- [ ] TypeScript compiles without errors

## Dependencies

- Story 004 (create-argocd-detection-module) - Need checkForApplicationCRD() and detectInNamespace()
- Story 005 (implement-version-extraction) - Need version extraction working

## Notes

- Configuration precedence is critical - follow spec exactly
- Use structured logging with context objects
- Timeout prevents detection from blocking operator startup
- Default namespace is "argocd", default selector is "app.kubernetes.io/name=argocd-server"

