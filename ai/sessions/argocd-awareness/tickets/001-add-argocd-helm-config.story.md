---
story_id: add-argocd-helm-config
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: completed
priority: high
estimated_minutes: 15
---

## Objective

Add ArgoCD configuration section to Helm values.yaml and update values.schema.json to validate the new configuration options.

## Context

This is the first step in implementing ArgoCD awareness. We need to define the configuration interface that users will use to control ArgoCD detection behavior. This follows Helm best practices for chart configuration.

## Implementation Steps

1. Open `charts/kube9-operator/values.yaml`
2. Add new `argocd` section with configuration fields:
   ```yaml
   # ArgoCD integration configuration
   argocd:
     # Enable automatic ArgoCD detection (default: true)
     autoDetect: true
     
     # Explicitly enable or disable ArgoCD integration (optional)
     # enabled: true
     
     # Custom namespace where ArgoCD is installed (default: "argocd")
     # namespace: "argocd"
     
     # Custom label selector for ArgoCD server deployment (optional)
     # selector: "app.kubernetes.io/name=argocd-server"
     
     # Detection check interval in hours (default: 6)
     detectionInterval: 6
   ```
3. Open `charts/kube9-operator/values.schema.json`
4. Add validation schema for `argocd` configuration:
   ```json
   "argocd": {
     "type": "object",
     "properties": {
       "autoDetect": {
         "type": "boolean",
         "default": true
       },
       "enabled": {
         "type": "boolean"
       },
       "namespace": {
         "type": "string",
         "default": "argocd"
       },
       "selector": {
         "type": "string",
         "default": "app.kubernetes.io/name=argocd-server"
       },
       "detectionInterval": {
         "type": "integer",
         "minimum": 1,
         "maximum": 24,
         "default": 6
       }
     }
   }
   ```

## Files Affected

- `charts/kube9-operator/values.yaml` - Add argocd configuration section
- `charts/kube9-operator/values.schema.json` - Add validation schema

## Acceptance Criteria

- [x] values.yaml contains complete argocd configuration section with comments
- [x] All configuration fields have sensible defaults
- [x] values.schema.json validates argocd configuration
- [x] detectionInterval is constrained between 1-24 hours
- [x] Schema validates boolean, string, and integer types correctly
- [x] helm lint passes with new configuration

## Dependencies

None - this is the first story in the sequence

## Notes

- Follow existing patterns in values.yaml for consistency
- Use commented-out optional fields (enabled, namespace, selector)
- Ensure default values match spec requirements

