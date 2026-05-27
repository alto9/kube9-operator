# Input Handling

## CLI Commands

### Default Command
```
kube9-operator [serve]           # Default: runs operator control loop
```

### Query Commands
```
kube9-operator query status [--format=<format>]
```

**Status Options:**
- `--format`: Output format (json|yaml|table), default: json

### Events Commands
```
kube9-operator query events list [options]
kube9-operator query events get <eventId> [--format=<format>]
```

**Events List Options:**
- `--type`: Filter by event type (cluster|operator|insight|assessment|health|system)
- `--severity`: Filter by severity level (info|warning|error|critical)
- `--since`: Filter events since date (ISO 8601)
- `--until`: Filter events until date (ISO 8601)
- `--object-kind`: Filter by object kind
- `--object-namespace`: Filter by object namespace
- `--object-name`: Filter by object name
- `--limit`: Limit number of results (default: 50, max: 1000)
- `--offset`: Skip number of results (default: 0)
- `--format`: Output format (json|yaml|table), default: json

**Events Get Options:**
- `--format`: Output format (json|yaml|table), default: json

### Assessment Commands
```
kube9-operator assess run [options]
kube9-operator assess list [options]
kube9-operator assess get <assessmentId> [--format=<format>]
kube9-operator assess summary [options]
kube9-operator assess history [options]
```

**Assess Run Options:**
- `--mode`: Run mode (full|pillar|single-check), default: full
- `--pillar`: Pillar filter (required when mode=pillar)
- `--check-id`: Check ID filter (required when mode=single-check)
- `--timeout-ms`: Per-check timeout in milliseconds (default: 30000, max: 300000)
- `--format`: Output format (json|yaml|table|compact), default: json

**Assess List Options:**
- `--state`: Filter by state (queued|running|completed|failed|partial)
- `--limit`: Limit number of results (default: 50, max: 1000)
- `--since`: Filter since date (ISO 8601)
- `--format`: Output format (json|yaml|table|compact), default: json

**Assess Get Options:**
- `--format`: Output format (json|yaml|table|compact), default: json

**Assess Summary Options:**
- `--since`: Filter since date (ISO 8601)
- `--limit`: Number of recent runs to aggregate (default: 50, max: 100)
- `--format`: Output format (json|yaml|table|compact), default: json

**Assess History Options:**
- `--pillar`: Filter by pillar
- `--result`: Filter by result (passing|failing|warning|skipped|error|timeout)
- `--severity`: Filter by severity (critical|high|medium|low|info)
- `--limit`: Limit number of results (default: 100, max: 1000)
- `--since`: Filter since date (ISO 8601)
- `--format`: Output format (json|yaml|table|compact), default: json

## Output Formats
- `json` (default): Pretty-printed JSON with 2-space indentation
- `yaml`: YAML format with 2-space indentation
- `table`: Human-readable table format
- `compact`: Compact table format (assessment commands only)

## Invocation
Extensions use `kubectl exec` into operator pod:
```bash
kubectl exec -n <namespace> deploy/kube9-operator -- kube9-operator <command> [options]
```

## Parsing
- Uses Commander.js for command-line argument parsing
- Uses Zod for option validation and type safety
- All date filters accept ISO 8601 format strings
