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

**Flags**:
- `<appName>` (required positional): Argo CD Application name.
- `--namespace=<appNamespace>` (required): Application namespace (`appNamespace` for the Argo CD API).
- `--format=json` (optional): Accepted as the only format; default is JSON. `table` and `yaml` are not supported for this subcommand.
- **Out of scope:** `--refresh` (and any flag that forces an Argo CD Application refresh before returning the tree). The CLI always returns the current resource-tree snapshot from argocd-server.

**Behavior**:
- **On-demand only:** Fetches `GET /api/v1/applications/{name}/resource-tree?appNamespace={appNamespace}` from in-cluster `argocd-server` at query time. No durable tree store in SQLite for M17.
- **Success stdout:** Exactly the unmodified Argo CD response body (raw JSON). Typical shape includes `nodes[]` with `group`, `kind`, `namespace`, `name`, `parentRefs`, optional health/sync. No operator-side node or byte truncation; large trees rely on `ARGOCD_API_TIMEOUT_MS` and Kubernetes exec payload limits. Platform operators should size memory and exec timeouts for large Applications.
- **Application identity:** `appName` + `appNamespace` match `argocd_apps` composite key `(cluster_id, app_namespace, app_name)`.
- **Timeout:** Each HTTP fetch uses `ARGOCD_API_TIMEOUT_MS` (default `30000`, minimum `1000`).
- **Failure:** Structured JSON error envelope on **stderr** only; stdout empty or non-JSON on failure. Operator global `health` remains unaffected. kube9-vscode falls back per its tier ladder.

**Stderr error envelope** (one JSON object):
```json
{ "ok": false, "code": "<CODE>", "message": "<human-readable>", "details": {} }
```
`details` is optional and must not include tokens, raw Authorization headers, or unbounded upstream bodies.

**Error codes** (minimum set):

| `code` | Meaning |
|--------|---------|
| `INVALID_ARGUMENT` | Missing/invalid `appName` or `--namespace` |
| `ARGOCD_NOT_DETECTED` | Argo CD not detected / resource-tree path unavailable |
| `ARGOCD_TOKEN_MISSING` | No dedicated bearer (`ARGOCD_API_BEARER_TOKEN` / `ARGOCD_API_TOKEN_FILE`) |
| `ARGOCD_API_UNREACHABLE` | Cannot reach argocd-server (DNS, connect, TLS hard failure) |
| `ARGOCD_AUTH_FAILED` | Token rejected (HTTP 401) |
| `ARGOCD_RBAC_DENIED` | Authorization denied (HTTP 403), including cluster-wide probe deny |
| `APPLICATION_NOT_FOUND` | Application missing for name/namespace (HTTP 404) |
| `TIMEOUT` | Exceeded `ARGOCD_API_TIMEOUT_MS` |
| `INTERNAL_ERROR` | Unexpected operator/runtime failure |

**Exit codes**:

| Exit | When |
|------|------|
| `0` | Success; raw resource-tree JSON on stdout |
| `2` | `INVALID_ARGUMENT` |
| `3` | `APPLICATION_NOT_FOUND` |
| `4` | `ARGOCD_TOKEN_MISSING` or `ARGOCD_AUTH_FAILED` |
| `5` | `ARGOCD_RBAC_DENIED` |
| `6` | `TIMEOUT` |
| `7` | `ARGOCD_API_UNREACHABLE` or `ARGOCD_NOT_DETECTED` |
| `1` | `INTERNAL_ERROR` or unclassified failure |

Consumers (kube9-vscode) should key primarily on stderr `code`; exit codes are stable for scripts.

**Authentication to argocd-server:**
- Platform admin supplies a **dedicated Argo CD API bearer token** by creating a Kubernetes Secret out-of-band and referencing it from Helm: `argocd.api.token.existingSecret` + `argocd.api.token.existingSecretKey` (default key `token`). When set, the chart mounts the key at `/var/run/secrets/kube9/argocd-api-token` and sets `ARGOCD_API_TOKEN_FILE` to that path. Chart does not create a Secret from plaintext values. Unset `existingSecret` is default-off (no mount/env).
- Resource-tree resolution order: non-empty `ARGOCD_API_BEARER_TOKEN`, else readable `ARGOCD_API_TOKEN_FILE`. **No** fallback to the Kubernetes ServiceAccount token on this path (even if M9 application-status collection still allows SA fallback until a later hardening story).
- Missing dedicated token → CLI `ARGOCD_TOKEN_MISSING` and `status.argocd.resourceTreeCapable: false`. Token present but probe RBAC denied → `ARGOCD_RBAC_DENIED` and `resourceTreeCapable: false`.

**Service discovery:** `ARGOCD_API_BASE_URL` when set; otherwise `https://{ARGOCD_API_SERVER_SERVICE_NAME}.{detectedNamespace}.svc.cluster.local` (default service name `argocd-server`). TLS verification follows `ARGOCD_API_TLS_INSECURE` (default false).

**`resourceTreeCapable` probe and demotion:**
- When Argo CD is `detected` and a dedicated token is configured, the operator runs a **lightweight probe** on the status / detection-adjacent loop (not only on first vscode query). After a successful probe, set `status.argocd.resourceTreeCapable: true` and omit `resourceTreeLastError`.
- **Demote** `resourceTreeCapable` to `false` only for **cluster-wide** problems: missing dedicated token, Argo CD not detected (omit capable fields when not detected), API unreachable, auth failure, or cluster-wide RBAC deny on probe. On demotion, set bounded `resourceTreeLastError: { code, message }` to the last global demotion reason.
- **Do not demote** for per-application CLI outcomes: `APPLICATION_NOT_FOUND`, per-app RBAC deny, or per-app `TIMEOUT`. Those return structured CLI errors only; global capability stays `true` when the last probe succeeded.
- Probe or query auth/connectivity failures that are cluster-wide demote capability as above.

**Minimum Argo CD RBAC** (platform admin; chart does not mutate Argo CD roles): the dedicated token identity must be allowed to `get` Applications (including resource-tree) for the Applications/projects intended for enrichment. Example policy (attach to the account that issued the token): `p, role:kube9-resource-tree, applications, get, */*, allow` (or a project-scoped variant). Chart README documents this onboarding; the chart does not apply Argo CD roles.

**Consumer:** kube9-vscode extension host via `kubectl exec` on graph open/refresh when `resourceTreeCapable` is true. Webview receives normalized `ApplicationResourceGraph` only (`topologySource: argocd_resource_tree` on success).

### Argo CD Apps Query (existing)

```bash
kube9-operator query argocd apps list [--format=json|yaml|table]
kube9-operator query argocd apps get <appNamespace>/<appName> [--format=json|yaml|table]
```

Reads SQLite `argocd_apps` snapshots (M9 application status collection). Independent of resource-tree on-demand fetch.
