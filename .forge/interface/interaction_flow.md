# Interaction Flow

## Status Query Flow
1. Extension determines operator namespace:
   - Checks `POD_NAMESPACE` environment variable (if available)
   - Falls back to default namespace `kube9-system`
   - Or reads `namespace` field from previously cached status
2. Extension queries ConfigMap:
   - `kubectl get configmap kube9-operator-status -n <namespace>`
   - Extracts `status` key value (JSON string)
3. Extension parses status:
   - Parses JSON string to `OperatorStatus` object
   - Validates structure and required fields
4. Extension validates freshness:
   - Compares `lastUpdate` timestamp with current time
   - Status is considered fresh if updated within last 5 minutes
   - Stale status may indicate operator issues
5. Extension determines capabilities:
   - Uses `tier` to determine available features (free vs pro)
   - Uses `health` to determine if operator is operational
   - Uses `registered` to determine if server features are available

## CLI Query Flow
1. Extension resolves operator pod:
   - Queries deployment: `kubectl get deployment kube9-operator -n <namespace>`
   - Uses deployment selector to find pod: `kubectl get pods -l app.kubernetes.io/name=kube9-operator -n <namespace>`
   - Selects first running pod from results
2. Extension executes CLI command:
   - `kubectl exec -n <namespace> <pod-name> -- kube9-operator <command> [options]`
   - Or uses deployment reference: `kubectl exec -n <namespace> deploy/kube9-operator -- kube9-operator <command> [options]`
3. Extension parses output:
   - Reads stdout from exec command
   - Parses based on `--format` option (json, yaml, or table)
   - Handles errors from stderr (JSON error objects)

## Assessment Flow
1. Extension triggers assessment:
   - `kube9-operator assess run [--mode=full|pillar|single-check] [options]`
   - Command returns assessment run record with `run_id`
2. Extension monitors progress:
   - `kube9-operator assess get <run_id>` to check state
   - States: queued → running → completed/failed/partial
3. Extension retrieves results:
   - `kube9-operator assess get <run_id>` for full assessment details
   - `kube9-operator assess history` for check-level history
   - `kube9-operator assess summary` for aggregated statistics
4. Extension displays results:
   - Uses `--format=table` or `--format=compact` for human-readable output
   - Uses `--format=json` or `--format=yaml` for programmatic consumption

## Events Query Flow
1. Extension queries events:
   - `kube9-operator query events list [--type=] [--severity=] [--since=] [options]`
   - Supports pagination with `--limit` and `--offset`
   - Supports filtering by object metadata (kind, namespace, name)
2. Extension retrieves specific event:
   - `kube9-operator query events get <eventId>`
   - Returns full event details including metadata
3. Extension processes results:
   - Parses JSON/YAML output based on `--format` option
   - Handles pagination metadata for list queries
