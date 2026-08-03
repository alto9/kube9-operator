# User Stories

## Status Exposure

### ConfigMap Details
- **Name**: `kube9-operator-status` (defined in `src/status/writer.ts` as `STATUS_CONFIGMAP_NAME`)
- **Namespace**: Operator namespace (default `kube9-system`, exposed via `status.namespace` field)
- **Key**: `status` (JSON string)
- **Update interval**: 60 seconds (configurable via `statusUpdateIntervalSeconds` in Helm values)
- **Stale threshold**: 5 minutes - extension treats status as degraded/unhealthy if `lastUpdate` > 5 minutes old

### Status Schema
- `mode`: "operated" (standard when operator running; `"enabled"` retained only for client compatibility)
- `version`: Operator semantic version
- `health`: "healthy" | "degraded" | "unhealthy"
- `lastUpdate`: ISO 8601 timestamp
- `error`: Error message if health is degraded/unhealthy, null otherwise
- `namespace`: Operator deployment namespace
- `collectionStats`: Collection success/failure statistics
- `argocd`: ArgoCD detection status

### Extension Behavior
- Extension queries operator status → operated cluster capabilities when ConfigMap is present
- Extension detects operator not installed → basic mode, installation prompts
- Extension reads ConfigMap from default namespace, then uses `namespace` field for subsequent operations

**Implementation**: Status written by `StatusWriter` class (`src/status/writer.ts`) which periodically calls `calculateStatus()` from `src/status/calculator.ts`.

## ArgoCD Awareness

### Detection Mechanism
1. **CRD Check**: Verifies `applications.argoproj.io` CRD exists in cluster
2. **Deployment Check**: Verifies ArgoCD server deployment exists in target namespace
3. **Version Extraction**: Extracts ArgoCD version from deployment image tag

### Configuration Options
- **autoDetect**: Enable automatic detection (default: true)
- **enabled**: Explicitly enable/disable (overrides autoDetect)
- **namespace**: Custom namespace (default: "argocd")
- **selector**: Custom label selector for server deployment (default: "app.kubernetes.io/name=argocd-server")
- **detectionInterval**: Periodic refresh interval in hours (default: 6)

### Behavior
- ArgoCD detected → status includes `argocd.detected: true`, namespace, version, lastChecked
- ArgoCD not installed → graceful degradation, `argocd.detected: false`
- Detection timeout → returns not detected (30s timeout protection)
- Periodic refresh → re-checks every 6 hours (configurable) via `ArgoCDDetectionManager`

**Implementation**: Detection logic in `src/argocd/detection.ts`, periodic management in `src/argocd/detection-manager.ts`. Status exposed via `status.argocd` field in ConfigMap.

### Future (M9) — implemented
- Application sync/health status in SQLite `argocd_apps`
- CLI `query argocd apps list|get`
- VS Code extension reads ArgoCD status for conditional features

### M17 — Resource-tree enrichment
- On-demand `GET /api/v1/applications/{name}/resource-tree` via CLI `query argocd resource-tree get <appName> --namespace=<appNs>`
- Raw unmodified JSON on stdout; structured stderr errors; no `--refresh`; no operator-side tree size cap
- Dedicated Argo CD API bearer only (no SA fallback on resource-tree path)
- Lightweight status-loop probe sets `status.argocd.resourceTreeCapable`; demote only on cluster-wide token/auth/unreachable/RBAC-probe failures
- kube9-vscode gates operator topology tier on `resourceTreeCapable`

## Event System

### Event Types
- **cluster**: Kubernetes cluster events (Pod failures, node issues, etc.)
- **operator**: Operator lifecycle events (startup, shutdown, health transitions)
- **insight**: Generated insights and recommendations
- **assessment**: Assessment run events
- **health**: Health check events
- **system**: System-level events

### Severity Levels
- **info**: Informational events
- **warning**: Warning-level events
- **error**: Error-level events
- **critical**: Critical failures requiring immediate attention

### Recording Mechanism
- **Non-blocking**: Event recording uses async queue (`EventQueueWorker`)
- **Queue-based**: Events enqueued immediately, processed in batches (max 10 per cycle)
- **Graceful degradation**: Database write failures logged but don't crash operator
- **Metrics**: Events tracked with Prometheus metrics (events_stored_total, events_errors_total)

### Query Capabilities
Events queryable via CLI (`kube9 events list` / `kube9-operator query events list`) with filters:
- **type**: Filter by event type (cluster, operator, insight, assessment, health, system)
- **severity**: Filter by severity (info, warning, error, critical)
- **since/until**: Filter by date range (ISO 8601 datetime)
- **objectKind**: Filter by Kubernetes object kind
- **objectNamespace**: Filter by Kubernetes object namespace
- **objectName**: Filter by Kubernetes object name
- **limit/offset**: Pagination support (max 1000 per query)

### Agent and Desktop co-consumers
- Desktop Pro AI agent tools and vscode are **co-consumers** of the same events query surface. The operator does not own debug playbooks or diagnostic synthesis.
- Agents read **already retained** events. This path does not expand cluster-event recording and does not add log capture.
- **Tier 2 filter subset:** Desktop Pro AI Tier 2 tools pass `--since` (ISO-8601 after client conversion) and `--format=json` on `events list`; optional `--limit` on `assessments history`. Other CLI filters remain available to vscode and direct exec only (see integration API contracts).
- **Retention outcome (user-visible):** info/warning events are retained for **7** days by default; error/critical for **30** days. Product copy that cites Operator history for agent/evidence must match this severity-split window (not a longer single-number promise).
- **Empty history is success:** A successful query that returns zero matching rows is a valid outcome (for example nothing retained in range, or rows already pruned). It is not an operator unhealthy/error state. Clients may treat absence of history as an evidence gap.

**Acceptance (events, agent consumers):**
- **Given** the operator is healthy and event rows exist within retention for the requested `--since` window,
- **When** a Desktop agent Tier 2 tool or vscode issues `query events list --format=json`,
- **Then** the operator returns `{ events, pagination }` with matching retained rows and does not synthesize debug guidance or playbook steps.
- **Given** no rows match filters or retention has pruned older rows,
- **When** the query succeeds with an empty `events` array,
- **Then** the outcome is a valid evidence gap, not an operator error state.

**Implementation**: Event types and severities defined in `src/types/event.ts`. Recording via `EventRecorder` (`src/events/event-recorder.ts`), queue processing via `EventQueueWorker` (`src/events/queue-worker.ts`), querying via `EventRepository` (`src/database/event-repository.ts`), CLI commands in `src/cli/commands/events.ts`.

## Assessment History Query

### Capabilities
Assessment check history is queryable via CLI (`kube9-operator query assessments history`) with filters such as pillar, result, severity, since, and limit (see integration API contracts for the command surface).

### Agent and Desktop co-consumers
- Desktop Pro AI agent tools and vscode may consume assessments history as a **posture / historical check signal**, not as a live incident log stream. Diagnostic playbooks and root-cause synthesis remain Desktop-owned.
- **Retention outcome (user-visible):** No new time-based TTL for assessment history. Rows remain until explicit remove or cascade with the parent assessment. Agents and contracts may rely only on whatever is still stored.
- **Empty or partial history is success:** Zero matching rows after a successful query is a normal gap, not a retention SLA failure and not an operator unhealthy state.

**Acceptance (assessments history, agent consumers):**
- **Given** stored assessment history rows exist,
- **When** a Desktop agent Tier 2 tool or vscode issues `query assessments history --format=json`,
- **Then** the operator returns `{ history, pagination }` describing past check outcomes only; it does not stream live pod logs or incident timelines.
- **Given** no matching history rows,
- **When** the query succeeds with an empty `history` array,
- **Then** the outcome is a valid posture/evidence gap, not an operator unhealthy state.

### Non-goals (this surface)
- Operator log capture, log retention tables, or log query for agent consumers
- Promising recovery of pruned live-API logs via operator history
- Agent-driven cluster mutation through operator query paths

## Data Collection (M8)

### Implemented Collectors
1. **ClusterMetadataCollector** (`src/collection/collectors/cluster-metadata.ts`)
   - Collects: Kubernetes version, cluster identifier, node count, provider, region/zone
   - Interval: 24h default (86400s), 3600s minimum
   - Random offset: 0-1 hour

2. **ResourceInventoryCollector** (`src/collection/collectors/resource-inventory.ts`)
   - Collects: Namespace counts (hashed IDs), pod/deployment/statefulset/replicaset/service counts
   - Interval: 6h default (21600s), 1800s minimum
   - Random offset: 0-1 hour

3. **ResourceConfigurationPatternsCollector** (`src/collection/collectors/resource-configuration-patterns.ts`)
   - Collects: Limits/requests, replica counts, image pull policies, security contexts, probes, volume types, service types
   - Interval: 12h default (43200s), 3600s minimum
   - Random offset: 0-1 hour

4. **Performance metrics collector**
   - Collects: Bounded aggregate utilization/ratio rollups from optional in-cluster Prometheus (outbound scrape/query)
   - Interval: ~15m default, enforced minimum; random offset 0-1 hour
   - Degrade: When Prometheus is absent or unreachable, that collector tick degrades gracefully; the operator continues and other collectors stay on schedule. No metrics-server / Kubernetes metrics API fallback.

5. **Security posture collector**
   - Collects: Cluster API aggregates only (privileged/hostPath/hostNetwork-style counts, NetworkPolicy coverage, basic NSA/CIS-oriented rollups)
   - Interval: ~24h default, enforced minimum; random offset 0-1 hour
   - Distinct from resource-configuration-patterns and from Trivy vulnerability scanning

### Collection Behavior
- **Scheduled**: Collections registered with `CollectionScheduler` (`src/collection/scheduler.ts`)
- **Random offset**: Each collection scheduled with 0-1 hour random offset to distribute load
- **Persistence**: SQLite `collections` path; append-only snapshot rows; no CRDs; no phone-home
- **Retention**: No time-based TTL (assessments-class); rows persist until explicit remove or operational cleanup; no count-based cap
- **Query**: Existing `query collections` CLI/types extended with additive `--type` values for the new collectors
- **Error handling**: Collection errors logged, metrics recorded, but don't crash operator
- **Retry**: Failed collections retry on next scheduled interval (no immediate retry)
- **Statistics**: Collection success/failure tracked in `CollectionStatsTracker` and exposed in status ConfigMap for all five types without changing the aggregate `collectionStats` field set
- **Consumer scope**: Operator schedule, status, and query are the outcomes of this surface; vscode/Desktop progressive enhancement of new types ships later

**Acceptance (schedule success):**
- **Given** the operator is running with collectors registered,
- **When** a performance-metrics or security-posture interval elapses,
- **Then** a successful tick persists a collections snapshot and participates in status `collectionStats` like the three peer collectors.

**Acceptance (Prometheus absent degrade):**
- **Given** in-cluster Prometheus is not configured, absent, or unreachable,
- **When** the performance-metrics collector would tick,
- **Then** the operator continues serving; health does not become unhealthy for that reason alone; other collectors keep their schedules; there is no metrics-server fallback.

**Acceptance (security posture queryable):**
- **Given** at least one successful security-posture snapshot is stored,
- **When** an operator issues `query collections` filtered to that type,
- **Then** the snapshot is returned on the existing collections list/get surface (no parallel query API).

**Acceptance (security posture partial API failure):**
- **Given** a required cluster-API list/read for security-posture fails mid-tick,
- **When** that tick completes,
- **Then** no new `security-posture` row is persisted; failure counters increment; the operator stays ready/healthy for that reason alone; the collector retries next interval.

**Acceptance (empty list for new type):**
- **Given** no rows yet exist for a new collections `--type`,
- **When** `query collections list` succeeds with an empty result for that filter,
- **Then** the outcome is a normal success / evidence gap, not an operator unhealthy state.

### Non-goals (this surface)
- vscode/Desktop consumer UX in the same milestone (progressive enhancement later)
- New Well-Architected assessment checks that consume these collections
- Trivy CVE duplication in security posture; RBAC risk rollups; broader CIS/NSA families beyond basic rollups
- metrics-server / Kubernetes metrics API as a performance source
- Phone-home, registration, or kube9-api sync of collection payloads
- CRDs or a parallel query API for these collectors

**Implementation**: Collectors initialized in `src/operator.ts`, scheduled via `CollectionScheduler`, stored locally via `LocalStorage` (`src/collection/storage.ts`).

## Open implementation decisions

### Resolved (events retention copy coordination)

Operator business-logic and integration contracts state the user-visible outcome: info/warning **7** days, error/critical **30** days by default, with cleanup every **6 hours** and Helm/env overrides of the effective store window. kube9-desktop interface contracts own evidence-footer and Pro retention microcopy; those surfaces must cite the severity-split pair (or both bands), not a single longer “N days” promise. No 90-day (or other unified) agent/history retention claim belongs in operator consumer prose.

### Performance metrics and security posture (collections)

- **CLI `--type` presentation:** Exact enum strings, help text, and table column widths for the two new types are locked with interface contracts; behavior stays on the existing collections list/get archetype (filters, formats, pagination, stderr errors).
- **Empty-list and degrade copy:** User-facing wording for empty successful lists vs Prometheus-degrade tick outcomes stays coordinated with interface and error_handling; business logic only fixes the outcome classes above.
