---
story_id: create-argocd-detection-module
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
diagram_id: [argocd-detection-flow]
status: completed
priority: high
estimated_minutes: 30
---

## Objective

Create a new ArgoCD detection module with interfaces and core detection functions (checkForApplicationCRD, detectInNamespace).

## Context

This is the core detection logic. The module will check for ArgoCD's Application CRD and verify the argocd-server deployment exists in the target namespace. Uses @kubernetes/client-node library patterns from context.

## Implementation Steps

1. Create new file `src/argocd/detection.ts`
2. Define interfaces:
   ```typescript
   import * as k8s from '@kubernetes/client-node';
   
   interface ArgoCDDetectionConfig {
     autoDetect: boolean;
     enabled?: boolean;
     namespace?: string;
     selector?: string;
     detectionInterval: number;
   }
   
   interface ArgoCDStatus {
     detected: boolean;
     namespace: string | null;
     version: string | null;
     lastChecked: string;
   }
   ```
3. Implement `checkForApplicationCRD()`:
   ```typescript
   async function checkForApplicationCRD(k8sClient: KubernetesClient): Promise<boolean> {
     try {
       const crd = await k8sClient.apiextensions.getCustomResourceDefinition(
         "applications.argoproj.io"
       );
       return crd !== null;
     } catch (error) {
       if (error.statusCode === 404) {
         return false;
       }
       logger.warn("Error checking for ArgoCD CRD", { error });
       return false;
     }
   }
   ```
4. Implement `detectInNamespace()`:
   ```typescript
   async function detectInNamespace(
     k8sClient: KubernetesClient,
     namespace: string,
     selector: string,
     timestamp: string
   ): Promise<ArgoCDStatus> {
     try {
       // Check if namespace exists
       const ns = await k8sClient.core.readNamespace(namespace);
       if (!ns) {
         return {detected: false, namespace: null, version: null, lastChecked: timestamp};
       }
       
       // Check for ArgoCD server deployment
       const deployments = await k8sClient.apps.listNamespacedDeployment(
         namespace, undefined, undefined, undefined, undefined, selector
       );
       
       if (deployments.items.length === 0) {
         return {detected: false, namespace: null, version: null, lastChecked: timestamp};
       }
       
       // Extract version (to be implemented in next story)
       const version = null; // Placeholder
       
       return {detected: true, namespace, version, lastChecked: timestamp};
     } catch (error) {
       logger.warn("Error detecting ArgoCD in namespace", { namespace, error });
       return {detected: false, namespace: null, version: null, lastChecked: timestamp};
     }
   }
   ```
5. Export functions for use in other modules

## Files Affected

- `src/argocd/detection.ts` - New file with detection logic
- `src/kubernetes/client.ts` - May need to ensure apiextensions client is available

## Acceptance Criteria

- [x] detection.ts module exists with all interfaces
- [x] checkForApplicationCRD() successfully detects CRD presence
- [x] checkForApplicationCRD() returns false for 404 errors
- [x] checkForApplicationCRD() logs warnings for other errors
- [x] detectInNamespace() checks namespace existence
- [x] detectInNamespace() lists deployments with label selector
- [x] detectInNamespace() returns correct ArgoCDStatus structure
- [x] All error cases are handled gracefully
- [x] Logging follows winston patterns from context
- [x] TypeScript compiles without errors

## Dependencies

- Story 002 (extend-operator-status-interface) - Need ArgoCDStatus type
- Story 003 (add-argocd-rbac-permissions) - Need RBAC permissions to work

## Notes

- Version extraction will be added in next story (placeholder for now)
- Follow error handling patterns from kubernetes-operator-development context
- Use structured logging with winston
- Default selector is "app.kubernetes.io/name=argocd-server"

