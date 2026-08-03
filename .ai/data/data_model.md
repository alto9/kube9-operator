# Data Model

## Operator Status

Exposed via ConfigMap `kube9-operator-status` in operator namespace.

| Property | Type | Description |
|----------|------|-------------|
| mode | `operated` \| `enabled` | Published mode (`operated` is standard; `enabled` retained for older clients only) |
| version | string | Semantic version (e.g., "1.0.0") |
| health | `healthy` \| `degraded` \| `unhealthy` | Current health status |
| lastUpdate | string | ISO 8601 timestamp |
| error | string \| null | Error message if health is degraded or unhealthy |
| namespace | string | Operator deployment namespace (e.g., "kube9-system") |
| collectionStats | object | Collection statistics (see CollectionStats below) |
| argocd | object | ArgoCD awareness information (see ArgoCDStatus below) |
| trivy | object | Trivy server detection status (`detected`, `serverUrl`, `version`, `lastChecked`) |
| assessment | object | Bounded summary of the last scheduled Well-Architected assessment tick |
| aiConformance | object | Bounded summary of the latest Kubernetes AI Conformance readiness run |

### CollectionStats

| Property | Type | Description |
|----------|------|-------------|
| totalSuccessCount | number | Total number of successful collections across all types |
| totalFailureCount | number | Total number of failed collections across all types |
| collectionsStoredCount | number | Number of rows in SQLite `collections` (durable truth via `CollectionRepository.countCollections`) |
| lastSuccessTime | string \| null | ISO 8601 timestamp of most recent successful collection |

### ArgoCDStatus

| Property | Type | Description |
|----------|------|-------------|
| detected | boolean | Whether ArgoCD is detected in the cluster |
| namespace | string \| null | Namespace where ArgoCD is installed (null if not detected) |
| version | string \| null | ArgoCD version extracted from deployment (null if not detected) |
| lastChecked | string | ISO 8601 timestamp of last detection check |
| resourceTreeCapable | boolean \| *omitted* | `true` after dedicated token is configured, Argo CD is detected, and the last lightweight status-loop / detection-adjacent probe succeeded. `false` when Argo CD is detected but capability is demoted for a **cluster-wide** reason (missing token, API unreachable, auth failure, cluster-wide RBAC deny on probe). Omitted when Argo CD is not detected. Per-application CLI failures (`APPLICATION_NOT_FOUND`, per-app RBAC, per-app timeout) do **not** flip this to `false`. |
| resourceTreeLastError | object \| *omitted* | Bounded last **global demotion** reason: `{ code, message }` when `resourceTreeCapable` is false and Argo CD is detected. Omitted when capable is true or Argo CD is not detected. Must not contain tokens or unbounded payloads. |
| applications | object \| *omitted* | When `argocd_apps` has rows: bounded summary (see below); omitted when none |

#### ArgoCDApplicationsPersistedSummary (nested under `argocd.applications`)

| Property | Type | Description |
|----------|------|-------------|
| storedCount | number | Number of rows in `argocd_apps` |
| lastCollectedAt | string \| null | ISO 8601 `MAX(observed_at)` over stored Applications |
| syncStatusCounts | `Record<string, number>` | Counts by `status.sync.status` (keys from each `status_json`) |
| healthStatusCounts | `Record<string, number>` | Counts by `status.health.status` (keys from each `status_json`) |

### AiConformanceSummary

Nested under `OperatorStatus.aiConformance`. This is the client-facing readiness summary for Kubernetes AI Conformance checklist evaluation. It is a Kube9 readiness assessment, not proof of official CNCF certification.

| Property | Type | Description |
|----------|------|-------------|
| checklistVersion | string | Checklist document version selected for the cluster, e.g. `KubernetesAIConformance-1.31` |
| kubernetesMinor | string | Cluster Kubernetes minor used for deterministic checklist selection, e.g. `1.31` |
| sourceRevision | string \| null | Git SHA, release tag, or packaged source identifier for bundled checklist data |
| lastCompletedAt | string \| null | ISO 8601 completion timestamp for the latest completed conformance run |
| lastOutcome | `none` \| `success` \| `failed` | Overall latest-run publication state |
| runState | `completed` \| `failed` \| `partial` \| null | Persisted lifecycle state for the latest run |
| runId | string \| null | Persisted run identifier for drill-through and debugging |
| totals | object | Aggregate counts across the selected checklist |
| categories | `Record<string, AiConformanceCategorySummary>` | Rollups by checklist category/section |
| requirements | `AiConformanceRequirementSummary[]` | Bounded per-requirement rows for UI clients |
| error | string \| null | Bounded error text when `lastOutcome` is `failed` |

#### AiConformanceTotals

| Property | Type | Description |
|----------|------|-------------|
| totalRequirements | number | Number of requirements in the selected checklist |
| mustRequirements | number | Number of MUST requirements |
| shouldRequirements | number | Number of SHOULD requirements |
| passed | number | Requirements evaluated as satisfied |
| failed | number | Requirements evaluated as not satisfied |
| warning | number | Requirements with advisory or partial-readiness findings |
| notApplicable | number | Requirements not applicable to the cluster context |
| notEvaluated | number | Requirements not evaluated because Kube9 lacks an objective signal |
| needsEvidence | number | Requirements requiring user, vendor, or policy evidence outside observable cluster state |

#### AiConformanceRequirementSummary

| Property | Type | Description |
|----------|------|-------------|
| id | string | Stable requirement identifier from the checklist |
| category | string | Checklist category/section |
| level | `MUST` \| `SHOULD` | Requirement level from the checklist |
| title | string | Short requirement title or description reference |
| status | `passed` \| `failed` \| `warning` \| `not-applicable` \| `not-evaluated` \| `needs-evidence` | Kube9 readiness evaluation result |
| rationale | string | Short bounded explanation suitable for status JSON |
| evidenceRef | string \| null | Optional reference to the observable signal, check, or required external evidence |

## Collection Models (M8)

Five scheduled collectors persist append-only snapshot rows in SQLite `collections` as `CollectionPayload` documents (discriminated on `type`). No CRDs. Operator owns producer shapes; peer Desktop foreshadows (flat `metrics` / `security` sketches, CRD notes) are non-normative.

**Cluster Metadata** (`cluster-metadata`, ~24h): Kubernetes version, cluster identifier, node count, provider, region/zone.

**Resource Inventory** (`resource-inventory`, ~6h): Namespace counts (hashed IDs), pod/deployment/statefulset/replicaset/service counts.

**Resource Configuration Patterns** (`resource-configuration-patterns`, ~12h): Limits/requests, replica counts, image pull policies, security contexts, probes, volume types, service types.

**Performance Metrics** (`performance-metrics`, ~15m): Bounded aggregate snapshot from optional in-cluster Prometheus (utilization / ratio style rollups). Not a raw time-series warehouse. When Prometheus is absent or unreachable, the collector degrades gracefully and does not invent metrics-server / Kubernetes metrics API data. Normative `data` catalog below; tick gather / degrade classification owned by the performance-metrics collector capability.

**Security Posture** (`security-posture`, ~24h): Bounded cluster-API aggregate counts and coverage rollups (privileged / hostPath / hostNetwork-style counts, NetworkPolicy coverage, basic NSA/CIS-oriented rollups from Kubernetes objects). Distinct from resource-configuration-patterns security-context counts and from Trivy image scanning (no CVE bodies). RBAC risk rollups and broader CIS/NSA families are out of scope for this payload. Normative `data` catalog below; tick gather / partial-API classification owned by the security-posture collector capability.

### CollectionPayload envelope

| Field | Type | Notes |
|-------|------|-------|
| version | string | Payload schema version (e.g. `v1.0.0`) |
| type | string enum | Closed: `cluster-metadata` \| `resource-inventory` \| `resource-configuration-patterns` \| `performance-metrics` \| `security-posture` |
| data | object | Type-specific; must match discriminant (Zod discriminated union at write time) |
| sanitization | object | `{ rulesApplied: string[], timestamp: string }` |

Identity and time live on `data` for all types: `timestamp` (ISO 8601), `collectionId` (`coll_*`), `clusterId` (`cls_*`).

### performance-metrics `data`

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| timestamp | string | yes | ISO 8601 |
| collectionId | string | yes | `coll_*` |
| clusterId | string | yes | `cls_*` |
| source | object | yes | `{ available: boolean, reason?: string }`; `reason` max 200 chars when present |
| utilization | object | no | Optional `cpu` / `memory` objects |
| utilization.cpu.clusterAvgRatio | number | no | `[0, 1]` when present |
| utilization.cpu.nodeHighWatermarkRatio | number | no | `[0, 1]` when present |
| utilization.memory.clusterAvgRatio | number | no | `[0, 1]` when present |
| utilization.memory.nodeHighWatermarkRatio | number | no | `[0, 1]` when present |
| ratios | object | no | Map of named ratios in `[0, 1]`; max **16** keys; each key length ≤ 64 |

**Reject:** raw Prometheus vector / series dumps, unbounded label cardinality maps, nested sample arrays, serialized `data` larger than **64 KiB**.

### security-posture `data`

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| timestamp | string | yes | ISO 8601 |
| collectionId | string | yes | `coll_*` |
| clusterId | string | yes | `cls_*` |
| privilegedHost | object | yes | Non-negative integer counts |
| privilegedHost.privilegedContainers | number | yes | ≥ 0 |
| privilegedHost.hostPathVolumes | number | yes | ≥ 0 |
| privilegedHost.hostNetworkPods | number | yes | ≥ 0 |
| privilegedHost.hostPIDPods | number | no | ≥ 0 when present |
| privilegedHost.hostIPCPods | number | no | ≥ 0 when present |
| networkPolicyCoverage | object | yes | Namespace coverage aggregates |
| networkPolicyCoverage.namespacesTotal | number | yes | ≥ 0 |
| networkPolicyCoverage.namespacesWithNetworkPolicy | number | yes | ≥ 0 |
| networkPolicyCoverage.coverageRatio | number | no | `[0, 1]` when present |
| nsaCisRollups | object | yes | Non-negative integer counters; max **24** keys; each key length ≤ 64 |

**Reject:** Trivy CVE bodies, `vulnerabilities` arrays, RBAC-risk blobs, serialized `data` larger than **64 KiB**.

### Durable write path

Successful collector ticks persist only through `CollectionRepository.insertCollection` (Zod validate then SQLite insert). `query collections` and status `collectionsStoredCount` reflect SQLite row counts. In-memory `LocalStorage` is not durable truth, must not drive `collectionsStoredCount`, and is removed from the collector durable write path (historical max-100 buffer is not a SQLite retention cap).

## SQLite Tables (at /data/kube9.db)

### assessments

Framework assessment run records.

**Retention (agent / Desktop consumers):** No time-based TTL. Rows persist until explicit remove or cascade. History consumers may rely only on whatever is still stored. See [consistency.md](consistency.md).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| run_id | TEXT | PRIMARY KEY | Unique assessment run identifier |
| mode | TEXT | NOT NULL, CHECK IN ('full', 'pillar', 'single-check') | Assessment execution mode |
| state | TEXT | NOT NULL, CHECK IN ('queued', 'running', 'completed', 'failed', 'partial') | Current lifecycle state |
| requested_at | TEXT | NOT NULL | ISO 8601 timestamp when assessment was requested |
| started_at | TEXT | NULL | ISO 8601 timestamp when assessment started |
| completed_at | TEXT | NULL | ISO 8601 timestamp when assessment completed |
| total_checks | INTEGER | NOT NULL, DEFAULT 0 | Total number of checks in this assessment |
| completed_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks completed |
| passed_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks that passed |
| failed_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks that failed |
| warning_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks with warnings |
| skipped_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks skipped |
| error_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks that errored |
| timeout_checks | INTEGER | NOT NULL, DEFAULT 0 | Number of checks that timed out |
| failure_reason | TEXT | NULL | Reason for failure if state is 'failed' |

**Indexes:**
- `idx_assessments_state` ON `assessments(state)`
- `idx_assessments_requested_at` ON `assessments(requested_at DESC)`
- `idx_assessments_completed_at` ON `assessments(completed_at DESC)`

### assessment_history

Individual check results from assessment runs.

**Retention:** Follows parent `assessments` via `ON DELETE CASCADE`. No separate time-based prune. See [consistency.md](consistency.md).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | Unique check result identifier |
| run_id | TEXT | NOT NULL, FOREIGN KEY → assessments(run_id) ON DELETE CASCADE | Assessment run ID |
| check_id | TEXT | NOT NULL | Well-Architected Framework check ID |
| pillar | TEXT | NOT NULL | Pillar name (e.g., 'security', 'reliability') |
| check_name | TEXT | NULL | Human-readable check name |
| status | TEXT | NOT NULL, CHECK IN ('passing', 'failing', 'warning', 'skipped', 'error', 'timeout') | Check result status |
| object_kind | TEXT | NULL | Kubernetes object kind if applicable |
| object_namespace | TEXT | NULL | Kubernetes object namespace if applicable |
| object_name | TEXT | NULL | Kubernetes object name if applicable |
| message | TEXT | NULL | Check result message |
| remediation | TEXT | NULL | Remediation guidance if check failed |
| assessed_at | TEXT | NOT NULL | ISO 8601 timestamp when check was assessed |
| duration_ms | INTEGER | NULL | Check execution duration in milliseconds |
| error_code | TEXT | NULL | Error code if check errored |

**Indexes:**
- `idx_assessment_history_run_id` ON `assessment_history(run_id)`
- `idx_assessment_history_pillar` ON `assessment_history(pillar)`
- `idx_assessment_history_status` ON `assessment_history(status)`
- `idx_assessment_history_assessed_at` ON `assessment_history(assessed_at DESC)`
- `idx_assessment_history_run_pillar` ON `assessment_history(run_id, pillar)`

### events

Event history for cluster, operator, assessment, health, and system events.

**Retention (agent / Desktop consumers):** Severity-split defaults (info/warning **7** days, error/critical **30** days) are the advertised consumer window. Pruned rows are gone. See [consistency.md](consistency.md).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | Event identifier (format: `evt_YYYYMMDD_HHMMSS_<random>`) |
| event_type | TEXT | NOT NULL | Event type: `cluster`, `operator`, `assessment`, `health`, `system` |
| severity | TEXT | NOT NULL | Severity level: `info`, `warning`, `error`, `critical` |
| title | TEXT | NOT NULL | Short event summary |
| description | TEXT | NULL | Optional detailed description |
| object_kind | TEXT | NULL | Kubernetes object kind if applicable |
| object_namespace | TEXT | NULL | Kubernetes object namespace if applicable |
| object_name | TEXT | NULL | Kubernetes object name if applicable |
| metadata | TEXT | NULL | JSON blob with additional event metadata |
| created_at | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_events_event_type` ON `events(event_type)`
- `idx_events_severity` ON `events(severity)`
- `idx_events_created_at` ON `events(created_at DESC)`
- `idx_events_object_kind` ON `events(object_kind, object_namespace, object_name)`

### Log entities

None. Operator SQLite does not model pod/workload container logs. Debugging log evidence is out of band for this store (live Kubernetes API via Desktop). Do not add log tables under this epic.

### schema_version

Tracks database schema migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| version | INTEGER | PRIMARY KEY | Schema version number |
| applied_at | TEXT | NOT NULL | ISO 8601 timestamp when migration was applied |
| description | TEXT | NULL | Migration description |

### image_scans

Records of vulnerability scan runs against a container image reference (digest or repo:tag as reported by the scanner).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| scan_id | TEXT | PRIMARY KEY | Unique scan identifier |
| image_reference | TEXT | NOT NULL | Image reference as collected from workloads / passed to Trivy |
| image_digest | TEXT | NULL | Digest when available |
| started_at | TEXT | NOT NULL | ISO 8601 timestamp |
| completed_at | TEXT | NULL | ISO 8601 timestamp when scan finished |
| state | TEXT | NOT NULL | Lifecycle: e.g. `queued`, `running`, `completed`, `failed`, `skipped` |
| scanner | TEXT | NOT NULL | e.g. `trivy` |
| error_message | TEXT | NULL | Populated when state is `failed` or scan was skipped due to missing scanner |

**Indexes:** `idx_image_scans_image_reference`, `idx_image_scans_completed_at DESC`, `idx_image_scans_state`.

### image_vulnerabilities

Normalized vulnerability findings linked to a scan (and optionally to originating workload metadata via application logic).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | Unique row identifier |
| scan_id | TEXT | NOT NULL, FOREIGN KEY → image_scans(scan_id) ON DELETE CASCADE | Parent scan |
| vulnerability_id | TEXT | NOT NULL | Scanner vulnerability ID (e.g. CVE) |
| severity | TEXT | NOT NULL | Normalized severity for filtering and metrics |
| package_name | TEXT | NULL | Affected package if reported |
| installed_version | TEXT | NULL | Installed version if reported |
| fixed_version | TEXT | NULL | Fixed version if reported |
| title | TEXT | NULL | Short title |
| raw_metadata | TEXT | NULL | Optional JSON blob for scanner-specific fields |

**Indexes:** `idx_image_vulnerabilities_scan_id`, `idx_image_vulnerabilities_severity`, `idx_image_vulnerabilities_vulnerability_id`.

**Retention:** Deleting a row in `image_scans` cascades to `image_vulnerabilities` (`ON DELETE CASCADE`). Optional time-based pruning is implemented in application code (`ImageScanRepository.deleteScansCompletedBefore`); there is no DB-level TTL trigger.

### collections (M8)

Stores serialized periodic collection payloads wrapped as `CollectionPayload` (`version`, `type`, `data`, `sanitization` plus identity/timestamp fields). Persisted JSON must match `CollectionPayload` at write time. Row model is **append-only**: each successful tick inserts a new `collection_id`, not a latest-only upsert.

**Retention (agent / Desktop consumers):** No time-based TTL (same class as assessments). No count-based cap. Rows persist until explicit remove or operational cleanup. Consumers rely only on whatever is still stored. See [consistency.md](consistency.md).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| collection_id | TEXT | PRIMARY KEY | Matches payload `collectionId` (e.g. `coll_*`) |
| cluster_id | TEXT | NOT NULL | Cluster identifier `cls_*` |
| type | TEXT | NOT NULL | `cluster-metadata` \| `resource-inventory` \| `resource-configuration-patterns` \| `performance-metrics` \| `security-posture` |
| collected_at | TEXT | NOT NULL | ISO 8601 (payload `timestamp`) |
| payload_json | TEXT | NOT NULL | Full `CollectionPayload` document as JSON |

**Indexes:** `idx_collections_cluster_id`, `idx_collections_type`, `idx_collections_collected_at` (DESC). Queried via `CollectionRepository` / `query collections` CLI.

**Type set:** Closed in application validation (Zod / TypeScript literals). SQLite `type` remains free TEXT (no DB CHECK). Additive kebab-case tokens only; do not rename existing type strings.

**Payload classes:**
- `performance-metrics`: bounded Prometheus aggregate snapshot (optional outbound source)
- `security-posture`: bounded cluster-API aggregate / coverage rollups (no Trivy CVE bodies, no RBAC risk rollups in this payload)
- Existing three types keep their current envelope roles unchanged

**Producer ownership:** Operator defines normative `CollectionPayload` shapes. Desktop foreshadowed flat `metrics` / `security` documents and CRD storage notes are non-normative for these rows.

### argocd_apps (M9)

Stores the latest **Argo CD Application** snapshot per cluster and Application identity (one row per `cluster_id` + `app_namespace` + `app_name`). The HTTP collector lives in [issue #55](https://github.com/alto9/kube9-operator/issues/55); `status_json` holds the full normalized payload (sync/health/revision details live there until a future migration extracts indexed columns). Optional `drift_json` is reserved for drift classification ([issue #56](https://github.com/alto9/kube9-operator/issues/56)). CLI read paths and operator status summaries are in [issue #58](https://github.com/alto9/kube9-operator/issues/58).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| cluster_id | TEXT | NOT NULL, PK part | Cluster identifier `cls_*` (same convention as `collections`) |
| app_namespace | TEXT | NOT NULL, PK part | Application `metadata.namespace` |
| app_name | TEXT | NOT NULL, PK part | Application `metadata.name` |
| observed_at | TEXT | NOT NULL | ISO 8601 when this snapshot was observed |
| status_json | TEXT | NOT NULL | Full normalized Application status document (JSON object); validated at write time; aligns with [#55](https://github.com/alto9/kube9-operator/issues/55) |
| drift_json | TEXT | NULL | Optional drift classification JSON ([#56](https://github.com/alto9/kube9-operator/issues/56)) |

**Primary key:** `(cluster_id, app_namespace, app_name)` — one current row per Application per cluster; `ArgoCDAppsRepository` upserts via `INSERT ... ON CONFLICT`.

**Indexes:** `idx_argocd_apps_cluster_observed` on `(cluster_id, observed_at DESC)`.

**CLI:** `query argocd apps list|get …`

**Implementation:** SQLite migration v5 in `src/database/schema.ts`, `ArgoCDAppsRepository` (`src/database/argocd-apps-repository.ts`), contracts in `src/database/argocd-apps-contracts.ts`; tests in `schema.test.ts` and repository tests (patterns consistent with `CollectionRepository` / `ImageScanRepository`).

### ai_conformance_runs (M10)

Stores Kubernetes AI Conformance readiness run records. Runs are selected by Kubernetes minor and bundled checklist version; they are independent from Well-Architected assessment runs but follow the same SQLite migration and repository patterns.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| run_id | TEXT | PRIMARY KEY | Unique conformance run identifier |
| checklist_version | TEXT | NOT NULL | Selected checklist document/version |
| kubernetes_minor | TEXT | NOT NULL | Cluster Kubernetes minor used for selection |
| source_revision | TEXT | NULL | Packaged checklist source revision, tag, or bundle identifier |
| state | TEXT | NOT NULL, CHECK IN ('completed', 'failed', 'partial') | Final run state |
| requested_at | TEXT | NOT NULL | ISO 8601 timestamp when the run was requested |
| started_at | TEXT | NULL | ISO 8601 timestamp when evaluation started |
| completed_at | TEXT | NULL | ISO 8601 timestamp when evaluation completed |
| total_requirements | INTEGER | NOT NULL, DEFAULT 0 | Total requirements in selected checklist |
| must_requirements | INTEGER | NOT NULL, DEFAULT 0 | MUST requirements in selected checklist |
| should_requirements | INTEGER | NOT NULL, DEFAULT 0 | SHOULD requirements in selected checklist |
| passed_count | INTEGER | NOT NULL, DEFAULT 0 | Requirements evaluated as satisfied |
| failed_count | INTEGER | NOT NULL, DEFAULT 0 | Requirements evaluated as not satisfied |
| warning_count | INTEGER | NOT NULL, DEFAULT 0 | Requirements with advisory findings |
| not_applicable_count | INTEGER | NOT NULL, DEFAULT 0 | Requirements not applicable to the cluster context |
| not_evaluated_count | INTEGER | NOT NULL, DEFAULT 0 | Requirements not objectively evaluated |
| needs_evidence_count | INTEGER | NOT NULL, DEFAULT 0 | Requirements needing external evidence |
| failure_reason | TEXT | NULL | Bounded failure explanation when state is `failed` |

**Indexes:** `idx_ai_conformance_runs_completed_at` on `completed_at DESC`, `idx_ai_conformance_runs_kubernetes_minor` on `kubernetes_minor`.

### ai_conformance_requirement_results (M10)

Stores per-requirement results for each conformance run.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | Unique result row identifier |
| run_id | TEXT | NOT NULL, FOREIGN KEY -> `ai_conformance_runs.run_id` ON DELETE CASCADE | Parent run |
| requirement_id | TEXT | NOT NULL | Stable checklist requirement identifier |
| category | TEXT | NOT NULL | Checklist section/category |
| level | TEXT | NOT NULL, CHECK IN ('MUST', 'SHOULD') | Requirement level |
| title | TEXT | NOT NULL | Short requirement title or description reference |
| status | TEXT | NOT NULL, CHECK IN ('passed', 'failed', 'warning', 'not-applicable', 'not-evaluated', 'needs-evidence') | Evaluation result |
| rationale | TEXT | NOT NULL | Short bounded explanation |
| evidence_ref | TEXT | NULL | Observable signal, related check id, or external-evidence reference |
| evaluated_at | TEXT | NOT NULL | ISO 8601 timestamp for this result |

**Indexes:** `idx_ai_conformance_requirement_results_run_id`, `idx_ai_conformance_requirement_results_category`, `idx_ai_conformance_requirement_results_status`, and unique `(run_id, requirement_id)`.

## Open implementation decisions

### Resolved (collection type literals and write-time validation)

Closed application set includes `performance-metrics` and `security-posture` alongside the three shipped types. TypeScript `CollectionPayload` / `CollectionRowType` and Zod `CollectionPayloadSchema` use a discriminated union on `type`. `CollectionRepository.insertCollection` rejects `type`/`data` mismatch and malformed envelopes (no row). SQLite `type` remains unconstrained TEXT.

### Resolved (payload field catalogs)

Normative `data` catalogs for `performance-metrics` and `security-posture` are under Collection Models above (including `source.available`, utilization/ratio bounds, privilegedHost / networkPolicyCoverage / nsaCisRollups, 64 KiB and key-count caps). Sanitization wrapping matches peer collectors (`rulesApplied`, `timestamp`).

### Resolved (durable write path)

`CollectionRepository.insertCollection` is the sole durable write. LocalStorage is off the durable path and does not own `collectionsStoredCount`. Existing collectors must use the same durable path so CLI and status match SQLite.

### Resolved (performance-metrics unavailable ticks)

When the performance-metrics collector is registered and Prometheus is unreachable / auth-failed / timed out / unusable/empty: **omit** a `collections` row and count the tick as a **collection failure** (no durable row). Do not persist success payloads with `source.available: false` for that path. Successful ticks write catalog payloads with `source.available: true` (optional utilization / ratios). Schema still accepts `source.available: false` for validation completeness, but the collector does not produce unavailable marker rows in v1. Security posture is not gated on Prometheus.
