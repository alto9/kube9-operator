---
story_id: create-helm-rbac-templates
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: completed
priority: high
estimated_minutes: 25
---

## Objective

Create Helm templates for RBAC resources: ServiceAccount, ClusterRole, ClusterRoleBinding, Role, and RoleBinding.

## Context

The operator needs proper RBAC permissions to read cluster metadata and write status ConfigMaps.

## Implementation Steps

1. Create `templates/serviceaccount.yaml`:
   - Conditional on `.Values.serviceAccount.create`
   - Uses helper for name

2. Create `templates/clusterrole.yaml`:
   - Conditional on `.Values.rbac.create`
   - Permissions to read nodes, namespaces (for future metrics)

3. Create `templates/clusterrolebinding.yaml`:
   - Links ClusterRole to ServiceAccount

4. Create `templates/role.yaml`:
   - Permissions to create/update ConfigMaps in kube9-system
   - Namespace-scoped

5. Create `templates/rolebinding.yaml`:
   - Links Role to ServiceAccount

All templates should:
- Include proper labels using helpers
- Be properly indented
- Follow Helm best practices

## Files Affected

- `charts/kube9-operator/templates/serviceaccount.yaml` (create)
- `charts/kube9-operator/templates/clusterrole.yaml` (create)
- `charts/kube9-operator/templates/clusterrolebinding.yaml` (create)
- `charts/kube9-operator/templates/role.yaml` (create)
- `charts/kube9-operator/templates/rolebinding.yaml` (create)

## Acceptance Criteria

- [ ] Templates render correctly with `helm template`
- [ ] RBAC resources have correct permissions
- [ ] Conditionals work properly
- [ ] Labels are applied consistently

## Dependencies

- create-helm-chart-structure

