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

Stores the latest **Argo CD Application** snapshot per cluster + Application identity, produced by the collector ([#55](https://github.com/alto9/kube9-operator/issues/55)) and optional drift classification ([#56](https://github.com/alto9/kube9-operator/issues/56)). CLI/status exposure is ([#58](https://github.com/alto9/kube9-operator/issues/58)).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| cluster_id | TEXT | NOT NULL, PK part | Cluster identifier `cls_*` (same convention as `collections`) |
| app_namespace | TEXT | NOT NULL, PK part | Application `metadata.namespace` |
| app_name | TEXT | NOT NULL, PK part | Application `metadata.name` |
| observed_at | TEXT | NOT NULL | ISO 8601 when this snapshot was collected |
| sync_status | TEXT | NULL | Normalized sync phase/status (align names with [#55](https://github.com/alto9/kube9-operator/issues/55) contract) |
| health_status | TEXT | NULL | Normalized health aggregate |
| revision | TEXT | NULL | Target/live revision from Argo CD when available |
| status_json | TEXT | NOT NULL | Full normalized Application payload JSON from [#55](https://github.com/alto9/kube9-operator/issues/55) (forward-compatible extension point) |
| drift_json | TEXT | NULL | Structured drift output from [#56](https://github.com/alto9/kube9-operator/issues/56) when present |

**Primary key:** `(cluster_id, app_namespace, app_name)` — one current row per Application per cluster; collector/repository uses upsert (`INSERT ... ON CONFLICT` or equivalent).

**Indexes:** `idx_argocd_apps_observed_at` ON `argocd_apps(observed_at DESC)` for recent-first queries.

**Implementation:** SQLite migration (next schema version after current `LATEST_SCHEMA_VERSION` in `src/database/schema.ts`), plus a repository class under `src/database/` following `CollectionRepository` / `ImageScanRepository` patterns; tests in `schema.test.ts` and repository tests.
