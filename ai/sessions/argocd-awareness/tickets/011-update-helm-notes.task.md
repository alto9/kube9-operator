---
task_id: update-helm-notes
session_id: argocd-awareness
type: documentation
status: completed
priority: low
---

## Description

Update Helm NOTES.txt to inform users about ArgoCD awareness feature and how to configure it.

## Reason

Users should be informed that the operator can detect ArgoCD and how to configure detection behavior. This is part of good user experience for Helm chart installation.

## Steps

1. Open `charts/kube9-operator/templates/NOTES.txt`
2. Add section about ArgoCD awareness after existing sections:
   ```
   {{- if .Values.argocd.autoDetect }}
   
   🔍 ArgoCD Awareness: Enabled
   The operator will automatically detect if ArgoCD is installed in your cluster.
   {{- if .Values.argocd.namespace }}
   - Checking namespace: {{ .Values.argocd.namespace }}
   {{- else }}
   - Checking default namespace: argocd
   {{- end }}
   {{- else }}
   
   ℹ️  ArgoCD Awareness: Disabled
   ArgoCD detection is disabled. To enable:
     helm upgrade {{ .Release.Name }} {{ .Chart.Name }} \
       --set argocd.autoDetect=true \
       --namespace {{ .Release.Namespace }} \
       --reuse-values
   {{- end }}
   ```
3. Test notes rendering with helm install --dry-run

## Resources

- `charts/kube9-operator/templates/NOTES.txt` - File to update
- Helm documentation on NOTES.txt: https://helm.sh/docs/chart_template_guide/notes_files/

## Completion Criteria

- [x] NOTES.txt includes ArgoCD awareness section
- [x] Conditional messages based on argocd.autoDetect value
- [x] Shows configured namespace if custom
- [x] Provides helm upgrade command to enable detection
- [x] helm template renders NOTES.txt correctly
- [x] Notes are informative and helpful to users

## Dependencies

- Story 001 (add-argocd-helm-config) - Need values.yaml configuration

## Notes

- Keep formatting consistent with existing NOTES.txt style
- Use emoji icons for visual clarity (🔍, ℹ️)
- Provide actionable information, not just status

