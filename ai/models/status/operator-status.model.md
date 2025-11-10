---
model_id: operator-status
---

# Operator Status Model

## Overview

The Operator Status model represents the current state and health of the kube9 operator, exposed via ConfigMap for consumption by the VS Code extension.

## Properties

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `mode` | enum | Yes | Operating mode of the operator | `"operated"` or `"enabled"` |
| `tier` | enum | Yes | User-facing tier name | `"free"` or `"pro"` |
| `version` | string | Yes | Operator version (semver) | `"1.0.0"` |
| `health` | enum | Yes | Current health status | `"healthy"`, `"degraded"`, or `"unhealthy"` |
| `lastUpdate` | string | Yes | ISO 8601 timestamp of last status update | `"2025-11-10T15:30:00Z"` |
| `registered` | boolean | Yes | Whether operator is registered with kube9-server | `true` or `false` |
| `error` | string \| null | Yes | Error message if unhealthy or degraded | `"Connection timeout"` or `null` |
| `clusterId` | string | No | Server-assigned cluster ID (pro tier only) | `"cls_abc123def456"` |

## Enumerations

### Mode

| Value | Description | Conditions |
|-------|-------------|------------|
| `operated` | Free tier mode | No API key configured OR API key invalid |
| `enabled` | Pro tier mode | Valid API key configured AND successfully registered |

### Tier

| Value | Description | Features Available |
|-------|-------------|-------------------|
| `free` | Free tier | Local webviews, basic resource management, no AI |
| `pro` | Pro tier | Rich UIs from server, AI recommendations, advanced dashboards |

### Health

| Value | Description | Operator State | Extension Behavior |
|-------|-------------|----------------|-------------------|
| `healthy` | All systems operational | Normal operation | Enable all tier features |
| `degraded` | Non-critical issues | Running with limitations | Show warning, enable fallback |
| `unhealthy` | Critical issues | Severe problems | Show error, fall back to basic |

## Relationships

### Belongs To
- **Kubernetes Cluster**: Each status instance belongs to one cluster
- **Operator Deployment**: Each status reflects one operator instance

### Used By
- **VS Code Extension**: Primary consumer, reads status to determine features
- **Cluster Administrators**: May inspect status for troubleshooting

## Validation Rules

### Required Fields

All fields marked as required MUST be present. Missing required fields indicate invalid status.

### Mode-Tier Consistency

| Mode | Allowed Tiers | Validation |
|------|---------------|------------|
| `operated` | `free` | Mode=operated → Tier must be "free" |
| `enabled` | `pro` | Mode=enabled → Tier must be "pro" |

### Timestamp Freshness

`lastUpdate` timestamp indicates when status was last written:
- **Fresh**: < 5 minutes old
- **Stale**: > 5 minutes old (indicates unhealthy operator)

Extension should treat stale status as `degraded` regardless of reported health.

### Version Format

`version` must follow semantic versioning (semver):
- Format: `MAJOR.MINOR.PATCH`
- Examples: `1.0.0`, `1.2.3`, `2.0.0-beta.1`

### Cluster ID Format

`clusterId` (when present) must follow pattern:
- Prefix: `cls_`
- Length: `cls_` + 12+ alphanumeric characters
- Example: `cls_abc123def456`

### Error Message

`error` field rules:
- Must be `null` when `health` is `"healthy"`
- Should be non-null when `health` is `"degraded"` or `"unhealthy"`
- Should be clear, actionable, and non-sensitive (no secrets, credentials)

## State Transitions

### Initial State

When operator first starts:

```typescript
{
  mode: apiKey ? "enabled" : "operated",
  tier: "free", // Initially free, changes to "pro" after registration
  version: OPERATOR_VERSION,
  health: "healthy",
  lastUpdate: new Date().toISOString(),
  registered: false,
  error: null,
  clusterId: undefined
}
```

### Free Tier (Operated) - Healthy

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-10T15:30:00Z",
  "registered": false,
  "error": null
}
```

### Pro Tier (Enabled) - Healthy

```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-10T15:30:00Z",
  "registered": true,
  "error": null,
  "clusterId": "cls_abc123def456"
}
```

### Pro Tier (Enabled) - Degraded (Server Unreachable)

```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "degraded",
  "lastUpdate": "2025-11-10T15:29:30Z",
  "registered": false,
  "error": "Failed to connect to kube9-server: connection timeout after 30s",
  "clusterId": null
}
```

### Unhealthy (Config Error)

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "unhealthy",
  "lastUpdate": "2025-11-10T15:25:00Z",
  "registered": false,
  "error": "Failed to write status ConfigMap: forbidden - check RBAC permissions"
}
```

## Storage

### ConfigMap Format

Stored in Kubernetes ConfigMap `kube9-operator-status` in namespace `kube9-system`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube9-operator-status
  namespace: kube9-system
  labels:
    app.kubernetes.io/name: kube9-operator
    app.kubernetes.io/component: status
data:
  status: |
    {
      "mode": "enabled",
      "tier": "pro",
      "version": "1.0.0",
      "health": "healthy",
      "lastUpdate": "2025-11-10T15:30:00Z",
      "registered": true,
      "error": null,
      "clusterId": "cls_abc123def456"
    }
```

## TypeScript Interface

```typescript
/**
 * Operator Status Model
 * Represents the current state and health of the kube9 operator
 */
interface OperatorStatus {
  /**
   * Operating mode of the operator
   * - operated: Free tier (no API key or invalid key)
   * - enabled: Pro tier (valid API key and registered)
   */
  mode: "operated" | "enabled";
  
  /**
   * User-facing tier name
   * - free: Limited features
   * - pro: Full features with AI
   */
  tier: "free" | "pro";
  
  /**
   * Operator version (semantic versioning)
   * @example "1.0.0"
   */
  version: string;
  
  /**
   * Current health status
   * - healthy: All systems operational
   * - degraded: Non-critical issues, operating with limitations
   * - unhealthy: Critical issues, requires attention
   */
  health: "healthy" | "degraded" | "unhealthy";
  
  /**
   * ISO 8601 timestamp of last status update
   * @example "2025-11-10T15:30:00Z"
   */
  lastUpdate: string;
  
  /**
   * Whether operator is registered with kube9-server
   * true only when mode="enabled" and registration successful
   */
  registered: boolean;
  
  /**
   * Error message if health is degraded or unhealthy
   * null when health is healthy
   */
  error: string | null;
  
  /**
   * Server-assigned cluster ID
   * Only present when tier="pro" and registered=true
   * @example "cls_abc123def456"
   */
  clusterId?: string;
}
```

## Go Struct

```go
// OperatorStatus represents the current state and health of the kube9 operator
type OperatorStatus struct {
    // Operating mode of the operator
    Mode string `json:"mode"`
    
    // User-facing tier name
    Tier string `json:"tier"`
    
    // Operator version (semantic versioning)
    Version string `json:"version"`
    
    // Current health status
    Health string `json:"health"`
    
    // ISO 8601 timestamp of last status update
    LastUpdate string `json:"lastUpdate"`
    
    // Whether operator is registered with kube9-server
    Registered bool `json:"registered"`
    
    // Error message if health is degraded or unhealthy
    Error *string `json:"error"`
    
    // Server-assigned cluster ID (optional, pro tier only)
    ClusterID *string `json:"clusterId,omitempty"`
}
```

## Constraints

### Update Frequency

- Status MUST be updated at least every 60 seconds
- Status updates should be atomic (write entire JSON at once)
- Failed updates should be retried with exponential backoff

### Size Limits

- Total JSON size should not exceed 4KB
- `error` message should not exceed 500 characters
- Long error messages should be truncated with "..."

### Backwards Compatibility

- New optional fields may be added in future versions
- Required fields must never be removed
- Enum values should never be removed (new values can be added)

## Extension Usage

### Reading Status

```typescript
async function getOperatorStatus(): Promise<OperatorStatus | null> {
  try {
    const configMap = await kubectl.getConfigMap(
      "kube9-operator-status",
      "kube9-system"
    );
    
    const status = JSON.parse(configMap.data.status) as OperatorStatus;
    
    // Validate required fields
    if (!status.mode || !status.tier || !status.version) {
      throw new Error("Invalid status: missing required fields");
    }
    
    return status;
    
  } catch (error) {
    if (error.code === 404) {
      return null; // Operator not installed
    }
    throw error;
  }
}
```

### Checking Freshness

```typescript
function isStatusFresh(status: OperatorStatus): boolean {
  const lastUpdate = new Date(status.lastUpdate);
  const age = Date.now() - lastUpdate.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  return age < fiveMinutes;
}
```

### Determining Features

```typescript
function determineAvailableFeatures(status: OperatorStatus | null): FeatureSet {
  if (!status) {
    return BASIC_FEATURES; // No operator
  }
  
  if (!isStatusFresh(status)) {
    return DEGRADED_FEATURES; // Stale status
  }
  
  if (status.tier === "pro" && status.health === "healthy") {
    return PRO_FEATURES;
  }
  
  if (status.tier === "free") {
    return FREE_FEATURES;
  }
  
  return DEGRADED_FEATURES; // Fallback
}
```

## Testing

### Unit Tests

- Parse valid status JSON
- Reject invalid JSON (missing required fields)
- Validate enum values
- Check timestamp format
- Validate version format
- Check cluster ID format

### Integration Tests

- Operator creates ConfigMap on startup
- Operator updates ConfigMap every 60 seconds
- Extension can read and parse ConfigMap
- Status reflects operator mode changes
- Status reflects registration state

### Property-Based Tests

- Generate random valid statuses
- Ensure all valid statuses serialize/deserialize correctly
- Ensure invalid statuses are rejected

