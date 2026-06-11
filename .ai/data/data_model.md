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
| collectionsStoredCount | number | Number of collections currently stored locally |
| lastSuccessTime | string \| null | ISO 8601 timestamp of most recent successful collection |

### ArgoCDStatus

| Property | Type | Description |
|----------|------|-------------|
| detected | boolean | Whether ArgoCD is detected in the cluster |
| namespace | string \| null | Namespace where ArgoCD is installed (null if not detected) |
| version | string \| null | ArgoCD version extracted from deployment (null if not detected) |
| lastChecked | string | ISO 8601 timestamp of last detection check |
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

**Cluster Metadata** (24h interval): Kubernetes version, cluster identifier, node count, provider, region/zone.

**Resource Inventory** (6h interval): Namespace counts (hashed IDs), pod/deployment/statefulset/replicaset/service counts.

**Resource Configuration Patterns** (12h interval): Limits/requests, replica counts, image pull policies, security contexts, probes, volume types, service types.

## SQLite Tables (at /data/kube9.db)

### assessments

Framework assessment run records.

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

Stores serialized periodic collection payloads (`ClusterMetadata`, `ResourceInventory`, `ResourceConfigurationPatternsData`) wrapped as `CollectionPayload` in `src/collection/types.ts`. Persisted JSON must match `CollectionPayload` at write time.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| collection_id | TEXT | PRIMARY KEY | Matches payload `collectionId` (e.g. `coll_*`) |
| cluster_id | TEXT | NOT NULL | Cluster identifier `cls_*` |
| type | TEXT | NOT NULL | `cluster-metadata` \| `resource-inventory` \| `resource-configuration-patterns` |
| collected_at | TEXT | NOT NULL | ISO 8601 (payload `timestamp`) |
| payload_json | TEXT | NOT NULL | Full `CollectionPayload` document as JSON |

**Indexes (suggested):** `cluster_id`, `type`, `collected_at` (DESC).

**Status:** Target schema and CLI read path captured in [issue #53](https://github.com/alto9/kube9-operator/issues/53); implement before or with collector tickets (#50–#54, #51).

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
