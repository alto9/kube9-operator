# Authorization

## Kubernetes RBAC
- Operator: minimal read-only permissions for cluster resources
- Extension: needs `pods/exec` in operator namespace for CLI queries
- ConfigMap: `get` on `kube9-operator-status`

## Zero Ingress
- No ingress required
- All communication is operator-initiated (outbound to in-cluster services)
- No external server communication
