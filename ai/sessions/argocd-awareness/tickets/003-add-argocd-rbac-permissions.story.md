---
story_id: add-argocd-rbac-permissions
session_id: argocd-awareness
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
status: pending
priority: high
estimated_minutes: 15
---

## Objective

Add RBAC permissions to the Helm chart ClusterRole for ArgoCD detection (CRDs, namespaces, deployments).

## Context

The operator needs read-only permissions to detect ArgoCD: check for CRDs, read namespaces, and list deployments. These permissions must be added to the ClusterRole template.

## Implementation Steps

1. Open `charts/kube9-operator/templates/clusterrole.yaml`
2. Add new RBAC rules for ArgoCD detection:
   ```yaml
   # ArgoCD detection permissions
   - apiGroups: ["apiextensions.k8s.io"]
     resources: ["customresourcedefinitions"]
     verbs: ["get", "list"]
   - apiGroups: [""]
     resources: ["namespaces"]
     verbs: ["get"]
   - apiGroups: ["apps"]
     resources: ["deployments"]
     verbs: ["get", "list"]
   ```
3. Add comment explaining why these permissions are needed
4. Ensure permissions are minimal (read-only, no write or delete)

## Files Affected

- `charts/kube9-operator/templates/clusterrole.yaml` - Add ArgoCD detection RBAC rules

## Acceptance Criteria

- [ ] ClusterRole includes customresourcedefinitions get/list permissions
- [ ] ClusterRole includes namespaces get permission
- [ ] ClusterRole includes deployments get/list permissions
- [ ] Permissions are read-only (no create, update, delete, patch)
- [ ] Comment explains ArgoCD detection purpose
- [ ] helm template renders ClusterRole correctly
- [ ] Permissions follow principle of least privilege

## Dependencies

- Story 001 (add-argocd-helm-config) - Logical dependency

## Notes

- Do NOT add resourceNames restrictions - need to check any CRD, namespace, or deployment
- Follow existing RBAC permission format in the file
- Add comment like: "# Check for ArgoCD CRDs, namespaces, and deployments"

