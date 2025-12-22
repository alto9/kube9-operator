---
spec_id: status-api-spec
feature_id: [status-exposure]
context_id: [kubernetes-operator-development]
---

# Operator Status API Specification

## Overview

The operator exposes its status through a Kubernetes ConfigMap that the VS Code extension can read to determine cluster tier and operator health.

## Status ConfigMap

### Resource Details

| Property | Value |
|----------|-------|
| Name | `kube9-operator-status` |
| Namespace | `kube9-system` |
| Type | ConfigMap |
| Update Frequency | Every 60 seconds |
| Readers | Any authenticated Kubernetes user |

### Data Schema

The ConfigMap contains a single key `status` with JSON-formatted data:

```typescript
interface OperatorStatus {
  // Operator mode: "operated" (free) or "enabled" (pro)
  mode: "operated" | "enabled";
  
  // User-facing tier name
  tier: "free" | "pro";
  
  // Operator version (semver)
  version: string;
  
  // Health status
  health: "healthy" | "degraded" | "unhealthy";
  
  // ISO 8601 timestamp of last status update
  lastUpdate: string;
  
  // Whether operator is registered with kube9-server (pro tier only)
  registered: boolean;
  
  // Error message if unhealthy or degraded
  error: string | null;
  
  // Namespace where the operator is running
  namespace: string;
  
  // Optional: Server-provided cluster ID (pro tier only)
  clusterId?: string;
}
```

### Example Status - Free Tier

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-10T15:30:00Z",
  "registered": false,
  "error": null,
  "namespace": "kube9-system"
}
```

### Example Status - Pro Tier (Healthy)

```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-10T15:30:00Z",
  "registered": true,
  "error": null,
  "namespace": "kube9-system",
  "clusterId": "cls_abc123def456"
}
```

### Example Status - Pro Tier (Degraded)

```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "degraded",
  "lastUpdate": "2025-11-10T15:29:30Z",
  "registered": false,
  "error": "Failed to connect to kube9-server: connection timeout after 30s",
  "namespace": "kube9-system",
  "clusterId": null
}
```

## Health Status Definitions

| Health | Condition | Operator Behavior | Extension Behavior |
|--------|-----------|-------------------|-------------------|
| `healthy` | All systems operational | Normal operation | Enable all tier features |
| `degraded` | Non-critical issue (e.g., server unreachable but operator running) | Continue with retry logic | Show warning, enable fallback features |
| `unhealthy` | Critical issue (e.g., can't write status, API errors) | Log errors, attempt recovery | Show error, fall back to basic mode |

## Update Logic

### Operator Update Cycle

The operator updates the status ConfigMap every 60 seconds:

```typescript
async function updateStatus() {
  const status: OperatorStatus = {
    mode: config.apiKey ? "enabled" : "operated",
    tier: config.apiKey && registered ? "pro" : "free",
    version: OPERATOR_VERSION,
    health: calculateHealth(),
    lastUpdate: new Date().toISOString(),
    registered: registrationState.isRegistered,
    error: lastError || null,
    namespace: process.env.POD_NAMESPACE || "kube9-system",
    clusterId: registrationState.clusterId || undefined
  };
  
  await k8sClient.createOrUpdateConfigMap(
    process.env.POD_NAMESPACE || "kube9-system",
    "kube9-operator-status",
    { status: JSON.stringify(status) }
  );
}
```

### Health Calculation

```typescript
function calculateHealth(): "healthy" | "degraded" | "unhealthy" {
  // Critical: Can't write to Kubernetes API
  if (!canWriteConfigMap) {
    return "unhealthy";
  }
  
  // Critical: Config invalid
  if (configErrors.length > 0) {
    return "unhealthy";
  }
  
  // Degraded: Pro mode but not registered
  if (config.apiKey && !registrationState.isRegistered) {
    return "degraded";
  }
  
  // Degraded: Registration attempts failing
  if (registrationState.consecutiveFailures > 3) {
    return "degraded";
  }
  
  return "healthy";
}
```

## Extension Query API

### Extension Logic

```typescript
interface CachedStatus {
  status: OperatorStatus | null;
  timestamp: number;
  mode: "basic" | "operated" | "enabled" | "degraded";
}

class OperatorStatusClient {
  private cache: CachedStatus | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  async getStatus(forceRefresh = false): Promise<CachedStatus> {
    // Check cache
    if (!forceRefresh && this.cache && 
        Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache;
    }
    
    // Query cluster
    try {
      const configMap = await kubectl.getConfigMap(
        "kube9-operator-status",
        "kube9-system"
      );
      
      const status = JSON.parse(configMap.data.status);
      
      // Check if status is stale
      const statusAge = Date.now() - new Date(status.lastUpdate).getTime();
      const isStale = statusAge > 5 * 60 * 1000; // 5 minutes
      
      const mode = isStale ? "degraded" : 
                   status.mode === "enabled" ? "enabled" : "operated";
      
      this.cache = {
        status,
        timestamp: Date.now(),
        mode
      };
      
      return this.cache;
      
    } catch (error) {
      // Operator not installed
      if (error.code === 404) {
        return {
          status: null,
          timestamp: Date.now(),
          mode: "basic"
        };
      }
      
      throw error;
    }
  }
}
```

## RBAC Requirements

### For Operator

The operator needs these permissions to manage the status ConfigMap:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-operator-status
  namespace: kube9-system
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["kube9-operator-status"]
  verbs: ["get", "create", "update", "patch"]
```

### For Extension Users

Extension users (developers) only need read access:

```yaml
# Most clusters grant this by default to authenticated users
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-status-reader
  namespace: kube9-system
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["kube9-operator-status"]
  verbs: ["get"]
```

## Error Handling

### Operator Cannot Write ConfigMap

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "unhealthy",
  "lastUpdate": "2025-11-10T15:20:00Z",
  "registered": false,
  "error": "Failed to write status ConfigMap: forbidden",
  "namespace": "kube9-system"
}
```

**Operator Behavior**:
- Log error with details
- Retry with exponential backoff
- Check RBAC permissions

**Extension Behavior**:
- Detect old timestamp
- Show degraded status to user
- Provide troubleshooting tips

### API Key Invalid

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "degraded",
  "lastUpdate": "2025-11-10T15:30:00Z",
  "registered": false,
  "error": "API key validation failed: 401 Unauthorized",
  "namespace": "kube9-system"
}
```

**Operator Behavior**:
- Fall back to free tier
- Clear registration state
- Continue operating in "operated" mode

**Extension Behavior**:
- Show error to user
- Suggest checking API key in Helm values
- Fall back to free tier features

## Compatibility

### Versioning

The status format uses semantic versioning. Breaking changes require major version bump.

**Version 1.0.0 (MVP)**:
- Initial status format as specified above

**Future Versions**:
- May add optional fields (backward compatible)
- Will not remove required fields
- Extension should ignore unknown fields

### Extension Compatibility

Extensions should handle:
- Missing optional fields gracefully
- Unknown values in enums (default to safe fallback)
- Status format version mismatches

```typescript
function parseStatus(raw: string): OperatorStatus {
  const parsed = JSON.parse(raw);
  
  // Validate required fields
  if (!parsed.mode || !parsed.tier || !parsed.version) {
    throw new Error("Invalid status format: missing required fields");
  }
  
  // Normalize unknown values
  if (!["operated", "enabled"].includes(parsed.mode)) {
    parsed.mode = "operated"; // Safe default
  }
  
  return parsed;
}
```

## Monitoring and Observability

### Operator Logs

The operator should log status updates at INFO level:

```
[INFO] Status updated: mode=enabled, tier=pro, health=healthy, registered=true
[WARN] Status update failed: error writing ConfigMap, retrying in 30s
[ERROR] Registration failed: API key validation returned 401
```

### Metrics (Future)

For observability platforms:

```
kube9_operator_status_updates_total{mode="enabled", health="healthy"} 150
kube9_operator_status_update_errors_total{error_type="api_timeout"} 2
kube9_operator_health_status{health="healthy"} 1
```

## Testing

### Unit Tests

- Parse valid status JSON
- Handle missing optional fields
- Detect stale status timestamps
- Cache expiry logic
- Error handling for invalid JSON

### Integration Tests

- Operator creates ConfigMap on startup
- Operator updates ConfigMap every 60s
- Extension can read ConfigMap
- Status reflects registration state
- Status reflects health state

### End-to-End Tests

- Fresh install → status shows "operated" + "free"
- Add API key → status transitions to "enabled" + "pro"
- Server unreachable → status shows "degraded"
- Remove API key → status reverts to "operated" + "free"

