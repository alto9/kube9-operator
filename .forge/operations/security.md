# Security

## Zero Ingress
- No ingress required
- All communication outbound to in-cluster services

## Minimal RBAC
- Read-only for cluster resources
- ConfigMap create/update for status only
- No secrets or credentials collected

## Non-Root Execution
- RunAsNonRoot
- Read-only filesystem where possible
