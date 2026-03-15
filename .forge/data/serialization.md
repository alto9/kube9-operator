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
- `tier`: `"free" | "pro"`
- `version`: string (semver)
- `health`: `"healthy" | "degraded" | "unhealthy"`
- `lastUpdate`: string (ISO 8601)
- `registered`: boolean
- `error`: string | null
- `namespace`: string
- `clusterId`: string | undefined (optional)
- `collectionStats`: CollectionStats object
- `argocd`: ArgoCDStatus object

## Collection Payloads

M8 collectors store data as JSON blobs in `collections` table. Schema validated before storage. (Note: collections table not yet implemented in current schema)
