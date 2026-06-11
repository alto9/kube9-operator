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
- `version`: Operator version (semantic versioning, e.g., "1.0.0")
- `health`: Health status ("healthy" | "degraded" | "unhealthy")
- `lastUpdate`: ISO 8601 timestamp of last status update
- `error`: Error message string or null
- `namespace`: Namespace where operator is running
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
- `trivy`: Trivy detection status object
  - `detected`: Boolean indicating if a Trivy server was probed successfully
  - `serverUrl`: Base URL when detected (or null)
  - `version`: Trivy server version when available (or null)
  - `lastChecked`: ISO 8601 timestamp of last detection check
- `assessment`: Bounded summary of the last scheduled assessment tick (counts and metadata)
- `aiConformance`: Kubernetes AI Conformance readiness summary
  - `checklistVersion`: Selected bundled checklist version
  - `kubernetesMinor`: Cluster Kubernetes minor used for checklist selection
  - `sourceRevision`: Bundled checklist source identifier or null
  - `lastCompletedAt`: ISO 8601 completion time or null
  - `lastOutcome`: `"none" | "success" | "failed"`
  - `runState`: `"completed" | "failed" | "partial" | null`
  - `runId`: Persisted run id or null
  - `totals`: Counts by MUST/SHOULD and readiness status
  - `categories`: Rollups by checklist category/section
  - `requirements`: Bounded per-requirement rows with id, category, level, title, status, rationale, and optional evidence reference
  - `error`: Bounded failure text or null

## Extension Flow
1. Extension checks for ConfigMap `kube9-operator-status` in operator namespace
2. Reads `status` key and parses JSON string to `OperatorStatus` object
3. Uses `namespace` field from status for subsequent operations (exec, pod discovery)
4. Validates freshness: checks `lastUpdate` timestamp (typically updated every 60 seconds)
5. Determines available features based on operator presence, optional integrations (for example ArgoCD/Trivy signals), `assessment`, `aiConformance`, and `health`

## Kubernetes AI Conformance Presentation Rules

- Client copy must describe the payload as **Kube9 Kubernetes AI Conformance readiness** or equivalent readiness language.
- Client copy must not claim official CNCF conformance or certification from this status payload alone.
- `not-evaluated` and `needs-evidence` rows are first-class outcomes. They should be shown as unresolved readiness evidence, not as passing or failing cluster checks.
- Rows should group by checklist category and distinguish MUST from SHOULD counts.
