---
feature_id: cli-query-interface
spec_id: [cli-architecture-spec, event-query-spec]
context_id: [nodejs-cli, commander-framework]
---

# CLI Query Interface Feature

## Overview

The operator must expose a CLI for querying events, operator status, and other data. The CLI is accessed by the VS Code extension via `kubectl exec` into the operator pod, enabling rich queries without exposing HTTP endpoints.

## Behavior

```gherkin
Feature: CLI Query Interface

Background:
  Given the operator binary supports multiple commands
  And the CLI uses commander for routing and zod for validation
  And the operator can run in "serve" mode or "query" mode

Scenario: Run operator in serve mode (default)
  Given the operator is deployed in Kubernetes
  When the container starts without CLI arguments
  Then it should run in "serve" mode
  And it should start the operator control loop
  And it should NOT exit until stopped

Scenario: Run operator in serve mode explicitly
  Given the operator binary is executed with argument "serve"
  When the command is: kube9-operator serve
  Then it should run in "serve" mode
  And it should start the operator control loop

Scenario: Query operator status via CLI
  Given the operator is running in serve mode
  When a user executes: kubectl exec -n kube9-system deploy/kube9-operator -- kube9-operator query status
  Then the CLI should connect to the database
  And it should read the current operator status
  And it should return JSON output:
    """json
    {
      "status": "enabled",
      "tier": "pro",
      "version": "1.0.0",
      "health": "healthy",
      "last_update": "2025-12-02T10:30:45.000Z"
    }
    """
  And the command should exit with code 0

Scenario: List all events via CLI
  Given 50 events exist in the database
  When a user executes: kubectl exec -n kube9-system deploy/kube9-operator -- kube9-operator query events list
  Then the CLI should return all 50 events in JSON format
  And events should be ordered by created_at DESC (newest first)
  And the command should exit with code 0

Scenario: Filter events by type
  Given 100 events exist with various types
  And 40 are operator events
  When a user executes: kube9-operator query events list --type=operator
  Then the CLI should return exactly 40 events
  And all events should have event_type = "operator"

Scenario: Filter events by severity
  Given events exist with various severity levels
  And 15 are critical severity
  When a user executes: kube9-operator query events list --severity=critical
  Then the CLI should return exactly 15 events
  And all events should have severity = "critical"

Scenario: Filter events by date range
  Given events exist spanning multiple days
  When a user executes: kube9-operator query events list --since=2025-12-01 --until=2025-12-05
  Then the CLI should return only events where created_at >= 2025-12-01 AND < 2025-12-05
  And events should be ordered by created_at DESC

Scenario: Filter events by object reference
  Given events reference various Kubernetes objects
  When a user executes: kube9-operator query events list --object-kind=Deployment --object-name=nginx
  Then the CLI should return only events referencing Deployment/nginx
  And events should match both kind and name filters

Scenario: Combine multiple filters
  Given various events exist
  When a user executes: kube9-operator query events list --type=insight --severity=warning --since=2025-12-01
  Then the CLI should return events matching ALL filters:
    | Filter    | Value     |
    | type      | insight   |
    | severity  | warning   |
    | since     | 2025-12-01|
  And the query should use database indexes efficiently

Scenario: Paginate event results
  Given 100 events exist in the database
  When a user executes: kube9-operator query events list --limit=20 --offset=40
  Then the CLI should return 20 events
  And it should skip the first 40 events
  And it should include pagination metadata:
    """json
    {
      "total": 100,
      "limit": 20,
      "offset": 40,
      "returned": 20
    }
    """

Scenario: Get single event by ID
  Given an event exists with ID "evt_20251202_103045_a7f3b9"
  When a user executes: kube9-operator query events get evt_20251202_103045_a7f3b9
  Then the CLI should return the complete event details:
    """json
    {
      "id": "evt_20251202_103045_a7f3b9",
      "event_type": "operator",
      "severity": "info",
      "title": "Operator started",
      "description": "Operator v1.0.0 started in free tier",
      "metadata": {"version": "1.0.0"},
      "created_at": "2025-12-02T10:30:45.000Z"
    }
    """
  And the command should exit with code 0

Scenario: Get non-existent event returns error
  Given no event exists with ID "evt_99999999_000000_fake00"
  When a user executes: kube9-operator query events get evt_99999999_000000_fake00
  Then the CLI should return an error message:
    """json
    {
      "error": "Event not found",
      "event_id": "evt_99999999_000000_fake00"
    }
    """
  And the command should exit with code 1

Scenario: Output events in JSON format (default)
  Given events exist in the database
  When a user executes: kube9-operator query events list --format=json
  Then the CLI should return valid JSON array
  And the JSON should be parseable by jq or other tools

Scenario: Output events in YAML format
  Given events exist in the database
  When a user executes: kube9-operator query events list --format=yaml
  Then the CLI should return valid YAML
  And the YAML should be parseable by yq or other tools
  And the YAML should use proper indentation and structure

Scenario: Output events in table format for humans
  Given events exist in the database
  When a user executes: kube9-operator query events list --format=table
  Then the CLI should return a formatted table:
    """
    ID                         TYPE      SEVERITY  TITLE                    CREATED
    evt_20251202_103045_a7f3b9 operator  info      Operator started         2025-12-02 10:30:45
    evt_20251202_102030_x9y8z7 insight   warning   Missing resource limits  2025-12-02 10:20:30
    """
  And the table should have headers
  And columns should be aligned for readability

Scenario: VS Code extension queries events
  Given the VS Code extension wants to display events
  And the user has pods/exec permissions in kube9-system namespace
  When the extension executes: kubectl exec -n kube9-system deploy/kube9-operator -- kube9-operator query events list --format=json --limit=50
  Then the CLI should return the latest 50 events as JSON
  And the extension should parse the JSON and display in Event Viewer UI
  And the entire operation should complete in < 2 seconds

Scenario: CLI validates arguments before querying
  Given the user provides invalid arguments
  When a user executes: kube9-operator query events list --severity=invalid-value
  Then the CLI should validate using zod schema
  And it should return an error: "Invalid severity level. Must be: info, warning, error, critical"
  And the command should exit with code 1
  And it should NOT attempt to query the database

Scenario: CLI handles database connection failures
  Given the database file is missing or corrupted
  When a user executes: kube9-operator query events list
  Then the CLI should attempt to connect to the database
  And it should detect the connection failure
  And it should return an error message:
    """json
    {
      "error": "Database unavailable",
      "details": "Cannot connect to /data/kube9.db"
    }
    """
  And the command should exit with code 1

Scenario: CLI query timeout protection
  Given a CLI query is executing
  When the query takes longer than 30 seconds
  Then the CLI should timeout and return an error
  And it should log the timeout for debugging
  And it should NOT leave hanging database connections

Scenario: Multiple simultaneous CLI queries
  Given the operator is running in serve mode
  When 5 CLI query commands are executed simultaneously from different kubectl exec sessions
  Then all 5 queries should succeed
  And they should NOT block each other
  And they should return consistent results
  And the database WAL mode should enable concurrent reads

Scenario: CLI includes version information
  Given the operator binary has version metadata
  When a user executes: kube9-operator --version
  Then the CLI should display the operator version
  And it should exit with code 0

Scenario: CLI displays help information
  Given the operator binary supports help
  When a user executes: kube9-operator --help
  Or: kube9-operator query --help
  Or: kube9-operator query events --help
  Then the CLI should display usage information
  And it should list available commands
  And it should list available flags and options
  And it should provide examples

Scenario: RBAC enforcement by Kubernetes
  Given a user does NOT have pods/exec permissions in kube9-system namespace
  When they attempt: kubectl exec -n kube9-system deploy/kube9-operator -- kube9-operator query events list
  Then Kubernetes should reject the request with RBAC error
  And the user should NOT be able to query events
  And the operator CLI should never be invoked

Scenario: CLI performance for large result sets
  Given 10,000 events exist in the database
  When a user executes: kube9-operator query events list --limit=1000
  Then the CLI should return results in < 100ms
  And it should use database indexes efficiently
  And memory usage should be reasonable (< 50MB for query)

Scenario: CLI handles special characters in object names
  Given an event references object with name "nginx-deployment-v1.2.3"
  When querying by object-name with special characters
  Then the CLI should properly escape and match the exact name
  And it should return the correct event
```

## Integration Points

- **VS Code Extension**: Primary consumer of CLI queries via kubectl exec
- **Kubernetes RBAC**: Enforces access control via pods/exec permissions
- **Database Manager**: CLI reads from shared SQLite database
- **Operator Pod**: CLI executes inside same pod as operator serve mode

## CLI Command Structure

```
kube9-operator
├── serve (default)
│   └── Runs operator control loop
└── query
    ├── status
    │   └── Get current operator status
    └── events
        ├── list [options]
        │   ├── --type=<string>
        │   ├── --severity=<string>
        │   ├── --since=<date>
        │   ├── --until=<date>
        │   ├── --object-kind=<string>
        │   ├── --object-namespace=<string>
        │   ├── --object-name=<string>
        │   ├── --limit=<number>
        │   ├── --offset=<number>
        │   └── --format=json|yaml|table
        └── get <event-id>
            └── --format=json|yaml|table
```

## Performance Requirements

- CLI startup time: < 100ms
- Query execution: < 100ms for most queries
- Large result sets (1000 events): < 500ms
- Timeout protection: 30 seconds maximum

## Non-Goals

- Interactive CLI mode (future enhancement)
- Real-time event streaming (future enhancement)
- Event filtering with complex SQL expressions (future enhancement)
- Export to CSV or other formats (future enhancement)

