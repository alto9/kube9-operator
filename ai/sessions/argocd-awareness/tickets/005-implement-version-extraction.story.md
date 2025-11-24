---
story_id: implement-version-extraction
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: completed
priority: medium
estimated_minutes: 20
---

## Objective

Implement extractVersion() function to extract ArgoCD version from deployment labels or image tags.

## Context

ArgoCD version helps users understand what version is installed and enables future version-specific features. Version can be extracted from deployment labels or by parsing the container image tag.

## Implementation Steps

1. Add to `src/argocd/detection.ts`
2. Implement extractVersion function:
   ```typescript
   function extractVersion(deployment: k8s.V1Deployment): string | null {
     // Try to get version from labels
     const labels = deployment.metadata?.labels || {};
     
     // Check common version label patterns
     const versionLabels = [
       "app.kubernetes.io/version",
       "argocd.argoproj.io/version",
       "version"
     ];
     
     for (const labelKey of versionLabels) {
       if (labels[labelKey]) {
         return labels[labelKey];
       }
     }
     
     // Try to extract from image tag
     const containers = deployment.spec?.template?.spec?.containers || [];
     const argoCDContainer = containers.find(c => 
       c.name === "argocd-server" || c.image?.includes("argocd")
     );
     
     if (argoCDContainer?.image) {
       const imageMatch = argoCDContainer.image.match(/:v?(\d+\.\d+\.\d+)/);
       if (imageMatch) {
         return `v${imageMatch[1]}`;
       }
     }
     
     return null;
   }
   ```
3. Update detectInNamespace() to use extractVersion():
   ```typescript
   const deployment = deployments.items[0];
   const version = extractVersion(deployment);
   ```
4. Add DEBUG logging when version cannot be determined

## Files Affected

- `src/argocd/detection.ts` - Add extractVersion() function and integrate it

## Acceptance Criteria

- [x] extractVersion() checks for app.kubernetes.io/version label
- [x] extractVersion() checks for argocd.argoproj.io/version label
- [x] extractVersion() checks for generic "version" label
- [x] extractVersion() falls back to parsing image tag
- [x] extractVersion() returns null if version cannot be determined
- [x] Image tag regex correctly extracts semantic versions
- [x] Version string includes "v" prefix when extracted from image
- [x] DEBUG log when version cannot be determined
- [x] detectInNamespace() calls extractVersion() for found deployments
- [x] Unit tests cover all version extraction methods

## Dependencies

- Story 004 (create-argocd-detection-module) - Need detection module first

## Notes

- Version detection is best-effort, not critical to ArgoCD awareness
- Null version is acceptable and expected in some cases
- Regex pattern matches: "v2.8.0", "2.8.0", etc.
- Prioritize labels over image tag parsing (more reliable)

