# Presentation

## Status ConfigMap
- **Name**: kube9-operator-status
- **Namespace**: Operator namespace (discovered via status.namespace or default kube9-system)
- **Key**: `status` (JSON)
- **Schema**: OperatorStatus (mode, tier, version, health, lastUpdate, error, namespace)

## Extension Flow
1. Check default namespace for ConfigMap
2. If found, read `namespace` field for subsequent operations
3. Use namespace for all operator interactions (exec, pod discovery)
