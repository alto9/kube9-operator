---
story_id: pass-config-via-deployment
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: completed
priority: medium
estimated_minutes: 20
---

## Objective

Update Helm deployment template to pass ArgoCD configuration to operator via environment variables.

## Context

The operator reads ArgoCD configuration from environment variables. The Helm deployment template needs to be updated to inject these values from values.yaml.

## Implementation Steps

1. Open `charts/kube9-operator/templates/deployment.yaml`
2. Add environment variables to container env section:
   ```yaml
   env:
   # ... existing env vars
   
   # ArgoCD configuration
   - name: ARGOCD_AUTO_DETECT
     value: {{ .Values.argocd.autoDetect | quote }}
   {{- if .Values.argocd.enabled }}
   - name: ARGOCD_ENABLED
     value: {{ .Values.argocd.enabled | quote }}
   {{- end }}
   {{- if .Values.argocd.namespace }}
   - name: ARGOCD_NAMESPACE
     value: {{ .Values.argocd.namespace | quote }}
   {{- end }}
   {{- if .Values.argocd.selector }}
   - name: ARGOCD_SELECTOR
     value: {{ .Values.argocd.selector | quote }}
   {{- end }}
   - name: ARGOCD_DETECTION_INTERVAL
     value: {{ .Values.argocd.detectionInterval | quote }}
   ```
3. Test template rendering with helm template
4. Verify all configuration values are passed correctly

## Files Affected

- `charts/kube9-operator/templates/deployment.yaml` - Add ArgoCD environment variables

## Acceptance Criteria

- [x] ARGOCD_AUTO_DETECT env var set from values.argocd.autoDetect
- [x] ARGOCD_ENABLED env var set conditionally if values.argocd.enabled is defined
- [x] ARGOCD_NAMESPACE env var set conditionally if values.argocd.namespace is defined
- [x] ARGOCD_SELECTOR env var set conditionally if values.argocd.selector is defined
- [x] ARGOCD_DETECTION_INTERVAL env var set from values.argocd.detectionInterval
- [x] All values properly quoted
- [x] helm template renders without errors
- [x] helm lint passes
- [x] Optional values (enabled, namespace, selector) use conditional templating

## Dependencies

- Story 001 (add-argocd-helm-config) - Need values.yaml configuration
- Story 007 (integrate-detection-on-startup) - Need env var parsing code

## Notes

- Follow existing env var patterns in deployment.yaml
- Use conditional blocks for optional values
- Quote all values to prevent YAML parsing issues
- Test with both minimal and full configuration

