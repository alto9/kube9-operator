# API Contracts

## Extension → Operator

### ConfigMap Read Contract

**Resource**: ConfigMap `kube9-operator-status`  
**Namespace**: Operator namespace (discovered via `status.namespace` field or defaults to `kube9-system`)  
**Key**: `status` (contains JSON string)  
**JSON Schema**: `OperatorStatus`

**Schema Fields**:
- `mode`: `"operated"` | `"enabled"` - Published operating mode
- `version`: string - Semantic version (e.g., `"1.0.0"`)
- `health`: `"healthy"` | `"degraded"` | `"unhealthy"` - Current health status
- `lastUpdate`: string - ISO 8601 timestamp
- `error`: string | null - Error message if unhealthy
- `namespace`: string - Operator deployment namespace (used for subsequent operations)
- `collectionStats`: object - Collection activity statistics
- `argocd`: object - ArgoCD detection status (`detected`, `namespace`, `version`, `lastChecked`, optional `resourceTreeCapable`, optional `resourceTreeLastError`)
- `trivy`: object - Trivy detection status (`detected`, `serverUrl`, `version`, `lastChecked`)
- `assessment`: object - Bounded Well-Architected assessment status summary
- `aiConformance`: object - Bounded Kubernetes AI Conformance readiness status summary

**Discovery Flow**:
1. Extension checks default namespace (`kube9-system`) for ConfigMap
2. If found, reads `status` key and parses JSON
3. Uses `status.namespace` field for all subsequent operator interactions
4. If ConfigMap not found in default namespace, operator is not installed (basic mode)

### Kubernetes AI Conformance Status Contract

The operator publishes `OperatorStatus.aiConformance` for kube9-vscode and kube9-desktop. This block is the only required client integration point for issue #141.

**Producer**: kube9-operator status writer  
**Consumers**: kube9-vscode and kube9-desktop operator-status parsers  
**Semantics**: Kube9 readiness assessment against bundled Kubernetes AI Conformance checklist data, not official CNCF certification

**Required fields**:
- `checklistVersion`: string - selected checklist document/version
- `kubernetesMinor`: string - Kubernetes minor used for deterministic checklist selection
- `sourceRevision`: string | null - checklist source revision, release tag, or package bundle identifier
- `lastCompletedAt`: string | null - latest completed run timestamp
- `lastOutcome`: `"none" | "success" | "failed"` - publication state
- `runState`: `"completed" | "failed" | "partial" | null` - persisted run state
- `runId`: string | null - persisted run id
- `totals`: object - counts for total, MUST, SHOULD, passed, failed, warning, not-applicable, not-evaluated, and needs-evidence
- `categories`: object - rollups by checklist category
- `requirements`: array - bounded per-requirement rows with `id`, `category`, `level`, `title`, `status`, `rationale`, and optional `evidenceRef`
- `error`: string | null - bounded failure reason when the latest run failed

**Requirement statuses**:
- `passed`: Observable cluster signal satisfies the requirement.
- `failed`: Observable cluster signal violates the requirement.
- `warning`: Observable signal is partially ready or advisory.
- `not-applicable`: Requirement does not apply to the current cluster context.
- `not-evaluated`: Kube9 has no objective signal for the requirement.
- `needs-evidence`: Requirement needs user, vendor, or policy evidence outside cluster-observable signals.

Clients must tolerate an absent `aiConformance` block until operator versions that include this feature are deployed.

### CLI Exec Contract

**Command Format**: `kubectl exec -n <namespace> deploy/kube9-operator -- kube9-operator query <command>`

**Pod Resolution**:
- Extension uses deployment name `kube9-operator` (or full name from Helm chart)
- Kubernetes resolves `deploy/kube9-operator` to the active pod automatically
- Extension requires `get` permission on deployments in operator namespace for pod discovery

**Available Query Commands**:

**Status Query**:
```bash
kube9-operator query status [--format=json|yaml|table]
```

**Events Query**:
```bash
kube9-operator query events list [--type=<type>] [--severity=<severity>] [--since=<ISO8601>] [--until=<ISO8601>] [--object-kind=<kind>] [--object-namespace=<ns>] [--object-name=<name>] [--limit=<number>] [--offset=<number>] [--format=json|yaml|table]
kube9-operator query events get <eventId> [--format=json|yaml|table]
```

**Assessments Query**:
```bash
kube9-operator query assessments list [--state=<state>] [--limit=<number>] [--since=<ISO8601>] [--format=json|yaml|table|compact]
kube9-operator query assessments get <assessmentId> [--format=json|yaml|table|compact]
kube9-operator query assessments summary [--since=<ISO8601>] [--limit=<number>] [--format=json|yaml|table|compact]
kube9-operator query assessments history [--pillar=<pillar>] [--result=<result>] [--severity=<severity>] [--limit=<number>] [--since=<ISO8601>] [--format=json|yaml|table|compact]
```

**Output Formats**:
- `json` (default): JSON output for programmatic consumption
- `yaml`: YAML output for human-readable structured data
- `table`: Human-readable tabular output
- `compact`: Compact format for assessments (assessment-specific)

### Assessment API Contract

**Run Command**: `kube9-operator assess run [options]`

**Run Modes**:
- `full`: Run all assessments across all pillars
- `pillar`: Run assessments for a specific pillar (requires `--pillar`)
- `single-check`: Run a single check by ID (requires `--check-id`)

**Options**:
- `--mode <mode>`: Run mode (`full`, `pillar`, `single-check`), default: `full`
- `--pillar <pillar>`: Pillar filter (required when `mode=pillar`). Valid values: `cost`, `operational-excellence`, `performance`, `reliability`, `security`, `sustainability`
- `--check-id <id>`: Check ID filter (required when `mode=single-check`)
- `--timeout-ms <ms>`: Per-check timeout in milliseconds, default: `30000`, max: `300000`
- `--format <format>`: Output format (`json`, `yaml`, `table`, `compact`), default: `json`

**Output Format**:
Returns assessment run record with:
- `id`: Assessment run ID
- `mode`: Run mode used
- `state`: `queued` | `running` | `completed` | `failed` | `partial`
- `started_at`: ISO 8601 timestamp
- `completed_at`: ISO 8601 timestamp (if completed)
- `results`: Array of check results with `check_id`, `pillar`, `status`, `severity`, `message`, etc.

**List Command**: `kube9-operator assess list [options]`

**Options**:
- `--state <state>`: Filter by state (`queued`, `running`, `completed`, `failed`, `partial`)
- `--limit <number>`: Limit results (default: 50, max: 1000)
- `--since <ISO8601>`: Filter since date
- `--format <format>`: Output format, default: `json`

**Get Command**: `kube9-operator assess get <assessmentId> [--format=<format>]`

**Summary Command**: `kube9-operator assess summary [options]`

**Options**:
- `--since <ISO8601>`: Filter since date
- `--limit <number>`: Number of recent runs to aggregate (default: 50, max: 100)
- `--format <format>`: Output format, default: `json`

**History Command**: `kube9-operator assess history [options]`

**Options**:
- `--pillar <pillar>`: Filter by pillar
- `--result <result>`: Filter by result (`passing`, `failing`, `warning`, `skipped`, `error`, `timeout`)
- `--severity <severity>`: Filter by severity (`critical`, `high`, `medium`, `low`, `info`)
- `--limit <number>`: Limit results (default: 100, max: 1000)
- `--since <ISO8601>`: Filter since date
- `--format <format>`: Output format, default: `json`

### Argo CD Resource-Tree Query (M17)

**Command**:
```bash
kube9-operator query argocd resource-tree get <appName> --namespace=<appNamespace> [--format=json]
```

**Behavior**:
- **On-demand only:** Fetches `GET /api/v1/applications/{name}/resource-tree` from in-cluster `argocd-server` at query time. No durable tree store in SQLite for M17.
- **Response:** Raw Argo CD resource-tree JSON (`nodes[]` with `group`, `kind`, `namespace`, `name`, `parentRefs`, optional health/sync). kube9-vscode consumes this via existing `buildResourceTreeApplicationResourceGraph`.
- **Application identity:** `appName` + `appNamespace` match `argocd_apps` composite key `(cluster_id, app_namespace, app_name)`.
- **Failure:** Structured stderr JSON error envelope; operator global `health` remains unaffected. Extension falls back per vscode tier ladder.

**Authentication to argocd-server:**
- Platform admin supplies a **dedicated Argo CD API bearer token** via Helm Secret / `ARGOCD_API_BEARER_TOKEN` or `ARGOCD_API_TOKEN_FILE`.
- Operator **must not** use its Kubernetes ServiceAccount token against argocd-server unless explicitly documented as a future opt-in; M17 requires dedicated token provisioning.
- Missing or denied credentials set `status.argocd.resourceTreeCapable: false` (or equivalent); extension uses CRD-flat fallback with actionable copy in kube9-vscode.

**Service discovery:** `ARGOCD_API_BASE_URL` or derived `https://{ARGOCD_API_SERVER_SERVICE_NAME}.{detectedNamespace}.svc.cluster.local`.

**Consumer:** kube9-vscode extension host via `kubectl exec` on graph open/refresh. Webview receives normalized `ApplicationResourceGraph` only.

### Argo CD Apps Query (existing)

```bash
kube9-operator query argocd apps list [--format=json|yaml|table]
kube9-operator query argocd apps get <appNamespace>/<appName> [--format=json|yaml|table]
```

Reads SQLite `argocd_apps` snapshots (M9 application status collection). Independent of resource-tree on-demand fetch.

## Open Implementation Decisions

Implementation-level items not yet fully specified. `/refine-issue` resolves these into timeless contract prose and removes or collapses bullets when done.

### Argo CD resource-tree (M17)

- Exact CLI flags: `--refresh`, exit codes for not-found vs RBAC-denied vs upstream timeout.
- Structured stderr JSON error envelope schema (`ARGOCD_NOT_DETECTED`, `ARGOCD_API_UNREACHABLE`, `ARGOCD_RBAC_DENIED`, `APPLICATION_NOT_FOUND`, `TIMEOUT`, etc.).
- Per-application fetch timeout and max node bounds for oversized trees.
- `resourceTreeCapable` probe cadence: piggyback on status loop vs on-first-query only.
- Helm chart docs for Secret mount and Argo CD RBAC prerequisites for resource-tree access.
- Whether CLI supports `table` format or json-only given payload size.
