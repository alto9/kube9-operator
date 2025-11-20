---
story_id: implement-periodic-detection
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
diagram_id: [argocd-detection-flow]
status: pending
priority: medium
estimated_minutes: 25
---

## Objective

Implement periodic ArgoCD detection that runs every 6 hours (configurable) and updates status only if detection result changed.

## Context

After startup, the operator should periodically re-check for ArgoCD to detect installations/uninstallations that happen while the operator is running. This enables scenarios like ArgoCD being installed after the operator starts.

## Implementation Steps

1. Create periodic detection manager (or add to existing status manager)
2. Implement periodic check function:
   ```typescript
   class ArgoCDDetectionManager {
     private intervalHandle: NodeJS.Timeout | null = null;
     private currentStatus: ArgoCDStatus;
     
     start(
       k8sClient: KubernetesClient,
       config: ArgoCDDetectionConfig,
       initialStatus: ArgoCDStatus
     ) {
       this.currentStatus = initialStatus;
       const intervalMs = config.detectionInterval * 60 * 60 * 1000; // hours to ms
       
       this.intervalHandle = setInterval(
         () => this.performPeriodicCheck(k8sClient, config),
         intervalMs
       );
       
       logger.info("ArgoCD periodic detection started", {
         intervalHours: config.detectionInterval
       });
     }
     
     stop() {
       if (this.intervalHandle) {
         clearInterval(this.intervalHandle);
         this.intervalHandle = null;
         logger.info("ArgoCD periodic detection stopped");
       }
     }
     
     private async performPeriodicCheck(
       k8sClient: KubernetesClient,
       config: ArgoCDDetectionConfig
     ) {
       try {
         logger.debug("Performing periodic ArgoCD detection");
         const newStatus = await detectArgoCDWithTimeout(k8sClient, config);
         
         // Check if status changed
         if (this.hasStatusChanged(newStatus)) {
           logger.info("ArgoCD status changed", {
             previous: {
               detected: this.currentStatus.detected,
               namespace: this.currentStatus.namespace
             },
             current: {
               detected: newStatus.detected,
               namespace: newStatus.namespace
             }
           });
           
           this.currentStatus = newStatus;
           // Trigger status update
           await this.updateOperatorStatus(newStatus);
         } else {
           logger.debug("ArgoCD status unchanged, skipping update");
         }
       } catch (error) {
         logger.error("Periodic ArgoCD detection failed", { error });
       }
     }
     
     private hasStatusChanged(newStatus: ArgoCDStatus): boolean {
       return (
         this.currentStatus.detected !== newStatus.detected ||
         this.currentStatus.namespace !== newStatus.namespace ||
         this.currentStatus.version !== newStatus.version
       );
     }
   }
   ```
3. Integrate into operator lifecycle:
   - Start during operator initialization
   - Stop during graceful shutdown
4. Ensure periodic check doesn't block other operations

## Files Affected

- `src/argocd/detection-manager.ts` - New file with periodic detection logic
- `src/index.ts` (or `src/operator.ts`) - Integrate manager into lifecycle

## Acceptance Criteria

- [ ] ArgoCDDetectionManager class created
- [ ] start() initializes periodic detection with configurable interval
- [ ] Interval calculated correctly from hours to milliseconds
- [ ] performPeriodicCheck() runs detection with timeout
- [ ] hasStatusChanged() compares all relevant fields
- [ ] Status update triggered only when status changes
- [ ] DEBUG log when status unchanged
- [ ] INFO log when status changes with before/after details
- [ ] ERROR log if periodic check fails
- [ ] stop() cleans up interval on shutdown
- [ ] Manager integrates into operator startup/shutdown
- [ ] Periodic checks don't block other operations

## Dependencies

- Story 006 (implement-detect-argocd-function) - Need detectArgoCDWithTimeout()
- Story 007 (integrate-detection-on-startup) - Need initial status
- Story 008 (add-argocd-status-to-configmap) - Need status update mechanism

## Notes

- Default interval is 6 hours (configurable via ARGOCD_DETECTION_INTERVAL)
- Use setInterval for periodic execution
- Catch errors to prevent interval from stopping
- Log status changes with structured logging showing before/after
- Follow graceful shutdown pattern from kubernetes-operator-development context

