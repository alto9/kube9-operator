# Presentation

## Status ConfigMap
- **Name**: `kube9-operator-status`
- **Namespace**: Operator namespace (from `POD_NAMESPACE` env var, defaults to `kube9-system`)
- **Key**: `status` (JSON string)
- **Labels**: 
  - `app.kubernetes.io/name: kube9-operator`
  - `app.kubernetes.io/component: status`

## Status Schema
The `status` key contains a JSON string with the following `OperatorStatus` structure:
- `mode`: Operating mode ("operated" | "enabled")
- `tier`: User-facing tier ("free" | "pro")
- `version`: Operator version (semantic versioning, e.g., "1.0.0")
- `health`: Health status ("healthy" | "degraded" | "unhealthy")
- `lastUpdate`: ISO 8601 timestamp of last status update
- `registered`: Boolean indicating registration with kube9-server
- `error`: Error message string or null
- `namespace`: Namespace where operator is running
- `clusterId`: Server-assigned cluster ID (optional, only when tier="pro" and registered=true)
- `collectionStats`: Collection statistics object
  - `totalSuccessCount`: Number of successful collections
  - `totalFailureCount`: Number of failed collections
  - `collectionsStoredCount`: Number of collections stored locally
  - `lastSuccessTime`: ISO 8601 timestamp of most recent successful collection (or null)
- `argocd`: ArgoCD status object
  - `detected`: Boolean indicating if ArgoCD is detected
  - `namespace`: Namespace where ArgoCD is installed (or null)
  - `version`: ArgoCD version string (or null)
  - `lastChecked`: ISO 8601 timestamp of last detection check

## Extension Flow
1. Extension checks for ConfigMap `kube9-operator-status` in operator namespace
2. Reads `status` key and parses JSON string to `OperatorStatus` object
3. Uses `namespace` field from status for subsequent operations (exec, pod discovery)
4. Validates freshness: checks `lastUpdate` timestamp (typically updated every 60 seconds)
5. Determines available features based on `tier` and `health` status
