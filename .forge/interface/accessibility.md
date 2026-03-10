# Accessibility

## RBAC for Extension Users
- **ConfigMap**: `get` on `kube9-operator-status` in operator namespace
- **CLI exec**: `create` on `pods/exec` in operator namespace
- **Pod resolution**: `get` on deployments in operator namespace

## Operator RBAC
- Minimal read-only for cluster resources
- ConfigMap create/update for status
- No write to arbitrary resources
