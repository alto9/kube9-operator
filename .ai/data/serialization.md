# Serialization

## CLI Command Structure

### Query Commands

```
kube9-operator query <subcommand>
```

**Available subcommands:**

- `kube9-operator query status` - Get operator status
  - Options: `--format <json|yaml|table>` (default: json)

- `kube9-operator query events list` - List events with filters
  - Options:
    - `--type <type>` - Filter by event type
    - `--severity <severity>` - Filter by severity level
    - `--since <date>` - Filter events since date (ISO 8601)
    - `--until <date>` - Filter events until date (ISO 8601)
    - `--object-kind <kind>` - Filter by object kind
    - `--object-namespace <namespace>` - Filter by object namespace
    - `--object-name <name>` - Filter by object name
    - `--limit <number>` - Limit number of results (default: 50)
    - `--offset <number>` - Skip number of results (default: 0)
    - `--format <json|yaml|table>` (default: json)

- `kube9-operator query events get <eventId>` - Get single event by ID
  - Options: `--format <json|yaml|table>` (default: json)

Agent and Desktop history consumers use these existing event list/get shapes. Results reflect **currently stored** rows after event retention prune (see [consistency.md](consistency.md)). Output does not carry a separate retention-window field today.

### Assessment query commands (history consumers)

```
kube9-operator query assessments <subcommand>
```

Normative query surface for co-consumers (Desktop, vscode, agents) is documented under integration `api_contracts.md`, including:

- `query assessments list|get|summary|history` with the filter and `--format` options listed there

Assessment history serialization is “rows still present,” not a time-bounded SLA. No assessment TTL metadata is required on responses.

### Assessment Commands

```
kube9-operator assess <subcommand>
```

**Available subcommands:**

- `kube9-operator assess run` - Run an assessment
  - Options:
    - `--mode <full|pillar|single-check>` - Run mode (default: full)
    - `--pillar <pillar>` - Pillar filter (required when mode=pillar)
    - `--check-id <id>` - Check ID filter (required when mode=single-check)
    - `--timeout-ms <ms>` - Per-check timeout in milliseconds (default: 30000)
    - `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator assess list` - List assessment runs
  - Options:
    - `--state <queued|running|completed|failed|partial>` - Filter by state
    - `--limit <number>` - Limit number of results (default: 50)
    - `--since <date>` - Filter since date (ISO 8601)
    - `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator assess get <assessmentId>` - Get single assessment by run ID
  - Options: `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator assess summary` - Get assessment summary
  - Options:
    - `--since <date>` - Filter since date (ISO 8601)
    - `--limit <number>` - Number of recent runs to aggregate (default: 50)
    - `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator assess history` - List assessment check history
  - Options:
    - `--pillar <pillar>` - Filter by pillar
    - `--result <passing|failing|warning|skipped|error|timeout>` - Filter by result
    - `--severity <severity>` - Filter by severity
    - `--limit <number>` - Limit number of results (default: 100)
    - `--since <date>` - Filter since date (ISO 8601)
    - `--format <json|yaml|table|compact>` (default: json)

### Kubernetes AI Conformance Commands

```
kube9-operator ai-conformance <subcommand>
```

**Available subcommands:**

- `kube9-operator ai-conformance run` - Run readiness evaluation for the current cluster
  - Options:
    - `--kubernetes-minor <minor>` - Override detected Kubernetes minor for deterministic test runs
    - `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator ai-conformance latest` - Get the latest persisted readiness summary
  - Options: `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator ai-conformance get <runId>` - Get one persisted readiness run
  - Options: `--format <json|yaml|table|compact>` (default: json)

- `kube9-operator ai-conformance requirements` - List requirement results for a run
  - Options:
    - `--run-id <runId>` - Run id; defaults to latest completed run when omitted
    - `--category <category>` - Filter by checklist category
    - `--status <passed|failed|warning|not-applicable|not-evaluated|needs-evidence>` - Filter by readiness status
    - `--level <MUST|SHOULD>` - Filter by requirement level
    - `--format <json|yaml|table|compact>` (default: json)

## CLI Output Formats

All CLI commands support `--format`:

| Format | Use Case | Available For |
|--------|----------|---------------|
| json | Default, programmatic consumption | All commands |
| yaml | Human-readable structured output | All commands |
| table | Human-readable tabular output | All commands |
| compact | Compact tabular output for assessments | Assessment commands only |

## Status JSON (ConfigMap)

Extension reads `status` key from ConfigMap `kube9-operator-status` in operator namespace. JSON schema matches `OperatorStatus` interface in `src/status/types.ts`:

- `mode`: `"operated" | "enabled"`
- `version`: string (semver)
- `health`: `"healthy" | "degraded" | "unhealthy"`
- `lastUpdate`: string (ISO 8601)
- `error`: string | null
- `namespace`: string
- `collectionStats`: CollectionStats object
- `argocd`: ArgoCDStatus object
- `trivy`: TrivyStatus object
- `assessment`: AssessmentStatusSummary object
- `aiConformance`: AiConformanceSummary object

## Collection Payloads

Collectors store data as JSON documents in the SQLite `collections` table. Schema validated before storage (`CollectionPayload` / `CollectionPayloadSchema`). Query surface: `kube9-operator query collections list|get` (additive `--type` values; same list/get pagination envelope as today).

### Envelope

Each stored document is a `CollectionPayload`:

| Field | Role |
|-------|------|
| `version` | Payload schema version |
| `type` | Discriminant: `cluster-metadata` \| `resource-inventory` \| `resource-configuration-patterns` \| `performance-metrics` \| `security-posture` |
| `data` | Type-specific bounded aggregate object (not a raw dump) |
| `sanitization` | Sanitization metadata / wrapping consistent with peer collectors |
| identity / time fields | `collectionId`, `clusterId`, `timestamp` (and peers as already defined for existing types) |

Persisted `payload_json` must match this envelope at write time. Operator owns the normative producer shape. Desktop foreshadowed flat `metrics` / `security` sketches and CRD notes are non-normative.

### Type semantics (serialization class)

| `type` | `data` class | Source class |
|--------|--------------|--------------|
| `cluster-metadata` | Cluster identity / topology aggregates | Kubernetes API |
| `resource-inventory` | Hashed namespace and workload counts | Kubernetes API |
| `resource-configuration-patterns` | Config-pattern rollups (limits, probes, security contexts, …) | Kubernetes API |
| `performance-metrics` | Bounded utilization / ratio aggregates | Optional in-cluster Prometheus (outbound); degrade when absent |
| `security-posture` | Bounded privileged/host* counts, NetworkPolicy coverage, basic NSA/CIS-oriented rollups | Kubernetes API only (no Trivy CVE bodies; no RBAC risk rollups in this type) |

Empty successful `query collections list` (including `--type` with no rows) remains normal success serialization. No retention-window fields on list/get JSON (see [consistency.md](consistency.md)).

### Status surface

`collectionStats` stays aggregate counters (`totalSuccessCount`, `totalFailureCount`, `collectionsStoredCount`, `lastSuccessTime`). New types participate in those counters without changing the CollectionStats field set. `collectionsStoredCount` is the SQLite `collections` row count, not an in-memory buffer size. Internal per-type tracker maps are not published on the status ConfigMap.

### performance-metrics `data` serialization

| Field | Notes |
|-------|-------|
| `timestamp`, `collectionId`, `clusterId` | Required identity/time |
| `source.available` | boolean; required |
| `source.reason` | optional string ≤ 200 chars |
| `utilization.cpu` / `utilization.memory` | optional; ratio fields in `[0, 1]` |
| `ratios` | optional named ratios in `[0, 1]`; ≤ 16 keys; key length ≤ 64 |

Reject raw series dumps and serialized `data` > 64 KiB. Zod discriminant `type: "performance-metrics"` must match this shape at write time.

### security-posture `data` serialization

| Field | Notes |
|-------|-------|
| `timestamp`, `collectionId`, `clusterId` | Required identity/time |
| `privilegedHost.*` | required privileged/hostPath/hostNetwork counts; optional hostPID/hostIPC |
| `networkPolicyCoverage.*` | required namespace totals; optional `coverageRatio` in `[0, 1]` |
| `nsaCisRollups` | required object of non-negative int counters; ≤ 24 keys; key length ≤ 64 |

Reject CVE / vulnerabilities / RBAC-risk bodies and serialized `data` > 64 KiB. Zod discriminant `type: "security-posture"` must match this shape at write time.

## Open implementation decisions

### Resolved (collection payload field-level serialization)

Field catalogs and Zod discriminant rules for `performance-metrics` and `security-posture` are normative above and in [data_model.md](data_model.md). Write-time mismatch rejection uses the existing `CollectionPayloadSchema` discriminated union at `CollectionRepository.insertCollection`. Degrade-tick choice (omit row vs persist `source.available: false`) is owned by the performance-metrics collector capability; both outcomes serialize only documents that pass this schema when a row is written.

### Resolved (retention metadata on query JSON)

Event list/get and assessments history JSON keep existing shapes (`events` / `history` plus `pagination`). No retention-window, configured-day, or prune “as of” fields are added for agent or Desktop consumers in this epic. Consumers bound queries with `--since` / `--until` against rows still present after severity-split retention (see [consistency.md](consistency.md)).

### Resolved (collections query JSON)

Collections list/get keep the generic envelope and pagination. New types appear as additive `type` / `--type` values only. No retention metadata, TTL, or count-cap fields are added to collections query JSON. Consumers read still-stored rows (assessments-class retention; see [consistency.md](consistency.md)).

### Out of scope (operator `--since` value forms)

The operator CLI validates `--since` / `--until` as **ISO-8601 datetimes** only. kube9-desktop converts relative windows (for example `24h`) before exec. Relative-duration aliases on the operator CLI are not part of this serialization contract; see integration [api_contracts.md](../integration/api_contracts.md).
