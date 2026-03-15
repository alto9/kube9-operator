# API Contracts

## Extension → Operator

### ConfigMap Read Contract

**Resource**: ConfigMap `kube9-operator-status`  
**Namespace**: Operator namespace (discovered via `status.namespace` field or defaults to `kube9-system`)  
**Key**: `status` (contains JSON string)  
**JSON Schema**: `OperatorStatus`

**Schema Fields**:
- `mode`: `"operated"` | `"enabled"` - Operating mode
- `tier`: `"free"` | `"pro"` - User-facing tier
- `version`: string - Semantic version (e.g., `"1.0.0"`)
- `health`: `"healthy"` | `"degraded"` | `"unhealthy"` - Current health status
- `lastUpdate`: string - ISO 8601 timestamp
- `registered`: boolean - Whether registered with kube9-server
- `error`: string | null - Error message if unhealthy
- `namespace`: string - Operator deployment namespace (used for subsequent operations)
- `clusterId`: string | undefined - Server-assigned cluster ID (Pro tier only)
- `collectionStats`: object - Collection activity statistics
- `argocd`: object - ArgoCD detection status (`detected`, `namespace`, `version`, `lastChecked`)

**Discovery Flow**:
1. Extension checks default namespace (`kube9-system`) for ConfigMap
2. If found, reads `status` key and parses JSON
3. Uses `status.namespace` field for all subsequent operator interactions
4. If ConfigMap not found in default namespace, operator is not installed (basic tier)

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
