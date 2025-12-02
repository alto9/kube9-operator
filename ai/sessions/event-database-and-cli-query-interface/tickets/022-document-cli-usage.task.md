---
task_id: 022-document-cli-usage
session_id: event-database-and-cli-query-interface
feature_id: [cli-query-interface]
spec_id: [cli-architecture-spec]
status: pending
---

# Task: Document CLI Usage and Examples

## Objective

Create comprehensive documentation for the operator CLI commands, including usage examples and integration patterns.

## Description

Document all CLI commands (`query status`, `query events list`, `query events get`) with examples, output formats, and integration guidance for VS Code extension developers.

## Requirements

- [ ] Document all CLI commands with syntax
- [ ] Provide usage examples for each command
- [ ] Show output format examples (JSON, YAML, table)
- [ ] Document filtering and pagination options
- [ ] Explain integration with VS Code extension
- [ ] Add troubleshooting section

## Files to Create

### Create docs/cli-reference.md

```markdown
# kube9-operator CLI Reference

## Overview

The kube9-operator binary supports two modes:

- **serve** (default): Runs the operator control loop
- **query**: Executes CLI queries for status and events

## Commands

### kube9-operator serve

Runs the operator control loop. This is the default mode when no command is specified.

**Usage:**
```bash
kube9-operator serve
# or simply:
kube9-operator
```

**Environment Variables:**
- `DB_PATH`: Database directory (default: `/data`)
- `LOG_LEVEL`: Logging level (debug|info|warn|error)
- `EVENT_RETENTION_INFO_DAYS`: Retention for info/warning events (default: 7)
- `EVENT_RETENTION_CRITICAL_DAYS`: Retention for error/critical events (default: 30)

---

### kube9-operator query status

Get current operator status including tier, health, and version.

**Usage:**
```bash
kube9-operator query status [--format=<format>]
```

**Options:**
- `--format`: Output format (json|yaml|table), default: json

**Example:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query status --format=json
```

**Output (JSON):**
```json
{
  "status": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "healthy",
  "last_update": "2025-12-02T10:30:45.000Z"
}
```

**Output (Table):**
```
status      : enabled
tier        : pro
version     : 1.0.0
health      : healthy
last_update : 2025-12-02T10:30:45.000Z
```

---

### kube9-operator query events list

List events with optional filtering and pagination.

**Usage:**
```bash
kube9-operator query events list [options]
```

**Options:**
- `--type <type>`: Filter by event type (cluster|operator|insight|assessment|health|system)
- `--severity <level>`: Filter by severity (info|warning|error|critical)
- `--since <date>`: Filter events since date (ISO 8601)
- `--until <date>`: Filter events until date (ISO 8601)
- `--object-kind <kind>`: Filter by Kubernetes object kind
- `--object-namespace <ns>`: Filter by object namespace
- `--object-name <name>`: Filter by object name
- `--limit <number>`: Limit results (default: 50, max: 1000)
- `--offset <number>`: Skip results (default: 0)
- `--format <format>`: Output format (json|yaml|table), default: json

**Examples:**

List recent events:
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query events list --limit=10
```

List critical events:
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query events list --severity=critical
```

List cluster events from today:
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query events list \
    --type=cluster \
    --since=2025-12-02T00:00:00Z
```

List events for specific Pod:
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query events list \
    --object-kind=Pod \
    --object-namespace=default \
    --object-name=nginx
```

Combine multiple filters:
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query events list \
    --type=cluster \
    --severity=error \
    --since=2025-12-01T00:00:00Z \
    --limit=100
```

**Output (JSON):**
```json
{
  "events": [
    {
      "id": "evt_20251202_103045_a7f3b9",
      "event_type": "cluster",
      "severity": "error",
      "title": "Pod CrashLoopBackOff: nginx",
      "description": "Container crash looping",
      "object_kind": "Pod",
      "object_namespace": "default",
      "object_name": "nginx",
      "metadata": {
        "reason": "CrashLoopBackOff",
        "count": 5
      },
      "created_at": "2025-12-02T10:30:45.123Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "returned": 50
  }
}
```

**Output (Table):**
```
ID                            TYPE      SEVERITY  TITLE                       CREATED
evt_20251202_103045_a7f3b9    cluster   error     Pod CrashLoopBackOff: ngin  2025-12-02 10:30:45
evt_20251202_102030_x9y8z7    cluster   warning   ImagePullBackOff: web-app   2025-12-02 10:20:30
```

---

### kube9-operator query events get

Get a single event by ID.

**Usage:**
```bash
kube9-operator query events get <event-id> [--format=<format>]
```

**Options:**
- `--format`: Output format (json|yaml|table), default: json

**Example:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query events get evt_20251202_103045_a7f3b9
```

**Output:**
```json
{
  "id": "evt_20251202_103045_a7f3b9",
  "event_type": "cluster",
  "severity": "error",
  "title": "Pod CrashLoopBackOff: nginx",
  "description": "Container crash looping",
  "object_kind": "Pod",
  "object_namespace": "default",
  "object_name": "nginx",
  "metadata": {
    "reason": "CrashLoopBackOff",
    "count": 5,
    "last_exit_code": 1
  },
  "created_at": "2025-12-02T10:30:45.123Z"
}
```

---

## VS Code Extension Integration

### OperatorQueryClient Usage

```typescript
import { OperatorQueryClient } from './operator-query-client';

const client = new OperatorQueryClient();

// Query recent events
const result = await client.queryEvents({
  limit: 50,
  severity: 'error',
});

console.log(`Found ${result.pagination.total} events`);
result.events.forEach(event => {
  console.log(`${event.severity}: ${event.title}`);
});

// Get specific event
const event = await client.getEvent('evt_20251202_103045_a7f3b9');
console.log(event.description);

// Query operator status
const status = await client.getOperatorStatus();
console.log(`Operator health: ${status.health}`);
```

---

## Troubleshooting

### Error: "Database unavailable"

**Cause:** SQLite database cannot be accessed.

**Solutions:**
- Verify PersistentVolume is mounted at `/data`
- Check operator logs for database errors
- Verify database file permissions

### Error: "Event not found"

**Cause:** Event ID doesn't exist or has been deleted by retention cleanup.

**Solutions:**
- Verify event ID is correct
- Check if event is within retention period (7-30 days)
- Query events list to find valid event IDs

### Error: "Permission denied" (kubectl exec)

**Cause:** User lacks `pods/exec` permission in operator namespace.

**Solution:**
```bash
kubectl create rolebinding kube9-query-events \
  --role=kube9-query-events \
  --user=$(kubectl config view -o jsonpath='{.users[0].name}') \
  --namespace=kube9-system
```

See RBAC documentation for details.

### Query timeout

**Cause:** Query took longer than 30 seconds.

**Solutions:**
- Reduce query scope with filters
- Reduce `--limit` parameter
- Check database performance with Prometheus metrics

---

## Performance Tips

1. **Use filters**: Always filter by type, severity, or date range when possible
2. **Limit results**: Use `--limit` to reduce result set size
3. **Pagination**: Use `--offset` for large result sets instead of retrieving everything
4. **Table format**: Use for human readability; JSON is faster for programmatic access

---

## Security Notes

- CLI queries are protected by Kubernetes RBAC
- Requires `pods/exec` permission in operator namespace
- All queries are logged in Kubernetes audit logs
- No sensitive data is stored in events (automatically redacted)
```

## Acceptance Criteria

- [ ] All CLI commands documented with examples
- [ ] Output format examples provided
- [ ] Integration guidance for VS Code extension
- [ ] Troubleshooting section included
- [ ] Performance tips provided
- [ ] Security notes documented

## Estimated Time

< 30 minutes

## Dependencies

None - this is documentation work

