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
  - `resourceTreeCapable` (optional boolean): Present when Argo CD is detected; `true` after successful lightweight resource-tree capability probe with dedicated token configured
  - `resourceTreeLastError` (optional `{ code, message }`): Last global demotion reason when capable is false and Argo CD is detected; omit when capable is true
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

## Collections Query Presentation

Operator CLI only this milestone (no vscode/desktop consumer UX contracts). Surface: `kube9-operator query collections list|get` via `kubectl exec`.

### List

- **Envelope (json/yaml):** `{ collections: [...summaries], pagination: { total, limit, offset, returned } }`.
- **Table / compact columns:** `COLLECTION_ID`, `CLUSTER_ID`, `TYPE`, `COLLECTED_AT` (unchanged for the two new types).
- **Empty success:** Zero matching rows (including `--type` for a new collector with no snapshots yet) is a normal success outcome. Table/compact print an empty-results line (today: `No results found`); json/yaml return an empty `collections` array with pagination totals of zero. Do not present empty list as unhealthy or as a transport failure.
- **TYPE values:** Additive kebab-case strings for performance metrics and security posture participate in the same `TYPE` column as the three shipped types. No per-type list layouts.

### Get

- Returns the full `CollectionPayload` for `<collectionId>`.
- Formats use the shared formatter: json/yaml for structured consumers; table/compact as generic key-value rendering of the payload object.
- No type-specific get table layouts for performance metrics or security posture in v1.

### Degrade and errors

- Prometheus absence / performance degrade is not a distinct CLI presentation mode. Unavailable performance ticks omit durable rows (collector contract); operators see empty type filters or missing rows, not a special “Prometheus unavailable” list/get cue.
- Not-found get and validation/runtime failures keep the existing JSON-on-stderr pattern and non-zero exit; they are distinct from empty successful list.

### Status ConfigMap

- New collection types participate in aggregate `collectionStats` counters only. No new status fields or per-type presentation schema for this milestone. Peer extensions continue progressive enhancement on the existing status shape.

### Table / compact TYPE column

- TYPE truncation stays **24** characters (compact) and **36** (table). New tokens (`performance-metrics`, `security-posture`) fit both widths. Longest shipped token `resource-configuration-patterns` (32) truncates in compact only; do not widen TYPE solely for the two new types.

### Empty-list copy

- Table/compact empty success uses the shared empty-results line `No results found` (same family as events/assessments). Do not invent a type-specific “no collections of this type yet” string.

## Open implementation decisions

### Resolved (TYPE truncation, get formatting, empty-list copy)

Keep TYPE truncation at 24 compact / 36 table. Keep generic `formatOutput` for get of new payload bodies in v1 (no type-specific table columns; human-oriented summary views deferred). Keep shared `No results found` empty-list copy; no type-specific empty string.
