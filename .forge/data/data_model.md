# Data Model

## Operator Status

Exposed via ConfigMap `kube9-operator-status` in operator namespace.

| Property | Type | Description |
|----------|------|-------------|
| mode | `operated` \| `enabled` | Operating mode (`operated` is standard, `enabled` reserved for future) |
| tier | `free` \| `pro` | User-facing tier (`free` is open source, `pro` reserved for future) |
| version | string | Semantic version (e.g., "1.0.0") |
| health | `healthy` \| `degraded` \| `unhealthy` | Current health status |
| lastUpdate | string | ISO 8601 timestamp |
| registered | boolean | Whether operator is registered with kube9-server |
| error | string \| null | Error message if health is degraded or unhealthy |
| namespace | string | Operator deployment namespace (e.g., "kube9-system") |
| clusterId | string \| undefined | Server-assigned cluster ID (only when tier="pro" and registered=true) |
| collectionStats | object | Collection statistics (see CollectionStats below) |
| argocd | object | ArgoCD awareness information (see ArgoCDStatus below) |

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

**Note:** Collections and argocd_apps tables are planned for future milestones (M8/M9) but are not yet implemented in the current schema.
