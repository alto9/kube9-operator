---
model_id: registration-data
---

# Registration Data Model

## Overview

The Registration Data model represents the data exchanged between the kube9 operator and kube9-server during the registration process.

## Registration Request

### Properties

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `operatorVersion` | string | Yes | Operator version (semver) | `"1.0.0"` |
| `clusterIdentifier` | string | Yes | Unique cluster identifier (SHA256 hash) | `"sha256:a1b2c3d4..."` |
| `kubernetesVersion` | string | Yes | Kubernetes version running in cluster | `"1.28.0"` |
| `approximateNodeCount` | number | Yes | Approximate number of nodes (for capacity planning) | `5` |

### Validation Rules

#### operatorVersion
- Must be valid semver format
- Examples: `"1.0.0"`, `"2.1.3"`, `"1.0.0-beta.1"`

#### clusterIdentifier
- Must start with `"sha256:"`
- Must be followed by hexadecimal characters
- Length: `"sha256:"` + 64 hex characters
- Total length: 71 characters
- Example: `"sha256:a1b2c3d4e5f6789..."`

#### kubernetesVersion
- Must be valid Kubernetes version string
- Format: `MAJOR.MINOR.PATCH`
- Examples: `"1.28.0"`, `"1.27.5"`

#### approximateNodeCount
- Must be a positive integer
- Range: 1 to 10000
- Does not need to be exact (used for capacity planning only)

### TypeScript Interface

```typescript
interface RegistrationRequest {
  /**
   * Operator version following semantic versioning
   * @example "1.0.0"
   */
  operatorVersion: string;
  
  /**
   * Unique cluster identifier (SHA256 hash of cluster CA cert or server URL)
   * @example "sha256:a1b2c3d4e5f6..."
   */
  clusterIdentifier: string;
  
  /**
   * Kubernetes version running in the cluster
   * @example "1.28.0"
   */
  kubernetesVersion: string;
  
  /**
   * Approximate number of nodes in the cluster
   * Used for capacity planning, does not need to be exact
   * @example 5
   */
  approximateNodeCount: number;
}
```

### Example JSON

```json
{
  "operatorVersion": "1.0.0",
  "clusterIdentifier": "sha256:a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789",
  "kubernetesVersion": "1.28.0",
  "approximateNodeCount": 5
}
```

## Registration Response

### Properties

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `status` | enum | Yes | Registration status | `"registered"` or `"reregistered"` |
| `clusterId` | string | Yes | Server-assigned cluster ID | `"cls_abc123def456"` |
| `tier` | enum | Yes | Confirmed tier | `"pro"` |
| `configuration` | object | Yes | Configuration settings for operator | See below |
| `message` | string | No | Optional message to operator | `"Welcome to kube9 Pro!"` |

### Configuration Object

| Property | Type | Required | Description | Default |
|----------|------|----------|-------------|---------|
| `statusUpdateIntervalSeconds` | number | Yes | How often to update status ConfigMap | `60` |
| `reregistrationIntervalHours` | number | Yes | How often to re-register with server | `24` |
| `metricsEnabled` | boolean | No | Whether to collect metrics (future feature) | `false` |
| `metricsIntervalSeconds` | number | No | Metrics collection interval (future) | `300` |

### Enumerations

#### status

| Value | Description | When Used |
|-------|-------------|-----------|
| `registered` | First-time registration | Cluster is registering for the first time |
| `reregistered` | Subsequent registration | Cluster has registered before |

#### tier

| Value | Description |
|-------|-------------|
| `pro` | Pro tier (only value for successful registration) |

### TypeScript Interface

```typescript
interface RegistrationResponse {
  /**
   * Registration status
   * - registered: First-time registration
   * - reregistered: Subsequent registration
   */
  status: "registered" | "reregistered";
  
  /**
   * Server-assigned cluster ID
   * Unique identifier for this cluster in kube9 system
   * @example "cls_abc123def456"
   */
  clusterId: string;
  
  /**
   * Confirmed tier
   * Only "pro" is returned for successful registration
   */
  tier: "pro";
  
  /**
   * Configuration settings for the operator
   */
  configuration: RegistrationConfiguration;
  
  /**
   * Optional message from server to operator
   * Can be displayed in logs or status
   * @example "Welcome to kube9 Pro!"
   */
  message?: string;
}

interface RegistrationConfiguration {
  /**
   * How often to update the status ConfigMap (in seconds)
   * @default 60
   */
  statusUpdateIntervalSeconds: number;
  
  /**
   * How often to re-register with the server (in hours)
   * @default 24
   */
  reregistrationIntervalHours: number;
  
  /**
   * Whether to collect cluster metrics (future feature)
   * @default false
   */
  metricsEnabled?: boolean;
  
  /**
   * How often to collect metrics (in seconds, future feature)
   * @default 300
   */
  metricsIntervalSeconds?: number;
}
```

### Example JSON - First Registration

```json
{
  "status": "registered",
  "clusterId": "cls_abc123def456",
  "tier": "pro",
  "configuration": {
    "statusUpdateIntervalSeconds": 60,
    "reregistrationIntervalHours": 24
  },
  "message": "Welcome to kube9 Pro!"
}
```

### Example JSON - Re-registration

```json
{
  "status": "reregistered",
  "clusterId": "cls_abc123def456",
  "tier": "pro",
  "configuration": {
    "statusUpdateIntervalSeconds": 60,
    "reregistrationIntervalHours": 24,
    "metricsEnabled": false
  },
  "message": "Welcome back!"
}
```

## Cluster Identifier Generation

### Algorithm

The operator generates a deterministic, unique identifier for the cluster:

```typescript
import { createHash } from 'crypto';

/**
 * Generate a unique identifier for the cluster
 * Uses cluster CA certificate if available, falls back to server URL
 */
function generateClusterIdentifier(kubeConfig: KubeConfig): string {
  const cluster = kubeConfig.getCurrentCluster();
  
  // Prefer CA certificate for identifier
  if (cluster.caData) {
    const hash = createHash('sha256')
      .update(cluster.caData)
      .digest('hex');
    return `sha256:${hash}`;
  }
  
  // Fallback to server URL
  const hash = createHash('sha256')
    .update(cluster.server)
    .digest('hex');
  return `sha256:${hash}`;
}
```

### Properties

- **Deterministic**: Same cluster always produces same identifier
- **Unique**: Different clusters produce different identifiers
- **Non-reversible**: Cannot extract CA cert or server URL from identifier
- **Privacy-preserving**: No sensitive data in identifier itself

### Example

```typescript
// Cluster with CA certificate
const cluster1 = {
  server: "https://10.0.0.1:6443",
  caData: "LS0tLS1CRUdJTi..." // Base64 CA cert
};

generateClusterIdentifier(cluster1);
// Returns: "sha256:a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789"

// Cluster without CA certificate (uses server URL)
const cluster2 = {
  server: "https://my-cluster.example.com:6443",
  caData: null
};

generateClusterIdentifier(cluster2);
// Returns: "sha256:x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4"
```

## Operator State Management

### Registration State

The operator maintains registration state in memory:

```typescript
interface RegistrationState {
  /**
   * Whether the operator is currently registered with kube9-server
   */
  isRegistered: boolean;
  
  /**
   * Server-assigned cluster ID
   */
  clusterId: string | null;
  
  /**
   * Timestamp of last successful registration
   */
  lastRegistration: Date | null;
  
  /**
   * Timestamp when next re-registration is due
   */
  nextRegistration: Date | null;
  
  /**
   * Number of consecutive registration failures
   */
  consecutiveFailures: number;
  
  /**
   * Last error message from registration attempt
   */
  lastError: string | null;
  
  /**
   * Configuration received from server
   */
  configuration: RegistrationConfiguration | null;
}
```

### Initial State

```typescript
const initialState: RegistrationState = {
  isRegistered: false,
  clusterId: null,
  lastRegistration: null,
  nextRegistration: null,
  consecutiveFailures: 0,
  lastError: null,
  configuration: null
};
```

### After Successful Registration

```typescript
const registeredState: RegistrationState = {
  isRegistered: true,
  clusterId: "cls_abc123def456",
  lastRegistration: new Date("2025-11-10T15:00:00Z"),
  nextRegistration: new Date("2025-11-11T15:00:00Z"), // 24 hours later
  consecutiveFailures: 0,
  lastError: null,
  configuration: {
    statusUpdateIntervalSeconds: 60,
    reregistrationIntervalHours: 24
  }
};
```

### After Failed Registration

```typescript
const failedState: RegistrationState = {
  isRegistered: false,
  clusterId: null,
  lastRegistration: null,
  nextRegistration: new Date("2025-11-10T15:05:00Z"), // Retry in 5 minutes
  consecutiveFailures: 1,
  lastError: "Connection timeout after 30s",
  configuration: null
};
```

## Validation

### Request Validation

```typescript
function validateRegistrationRequest(req: RegistrationRequest): ValidationResult {
  const errors: string[] = [];
  
  // Validate operatorVersion
  if (!isValidSemver(req.operatorVersion)) {
    errors.push("operatorVersion must be valid semver");
  }
  
  // Validate clusterIdentifier
  if (!req.clusterIdentifier.startsWith("sha256:")) {
    errors.push("clusterIdentifier must start with 'sha256:'");
  }
  if (req.clusterIdentifier.length !== 71) {
    errors.push("clusterIdentifier must be 71 characters (sha256: + 64 hex)");
  }
  
  // Validate kubernetesVersion
  if (!isValidK8sVersion(req.kubernetesVersion)) {
    errors.push("kubernetesVersion must be valid Kubernetes version");
  }
  
  // Validate approximateNodeCount
  if (req.approximateNodeCount < 1 || req.approximateNodeCount > 10000) {
    errors.push("approximateNodeCount must be between 1 and 10000");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Response Validation

```typescript
function validateRegistrationResponse(res: RegistrationResponse): ValidationResult {
  const errors: string[] = [];
  
  // Validate status
  if (!["registered", "reregistered"].includes(res.status)) {
    errors.push("status must be 'registered' or 'reregistered'");
  }
  
  // Validate clusterId
  if (!res.clusterId.startsWith("cls_")) {
    errors.push("clusterId must start with 'cls_'");
  }
  if (res.clusterId.length < 15) {
    errors.push("clusterId must be at least 15 characters");
  }
  
  // Validate tier
  if (res.tier !== "pro") {
    errors.push("tier must be 'pro' for successful registration");
  }
  
  // Validate configuration
  if (res.configuration.statusUpdateIntervalSeconds < 10) {
    errors.push("statusUpdateIntervalSeconds must be at least 10");
  }
  if (res.configuration.reregistrationIntervalHours < 1) {
    errors.push("reregistrationIntervalHours must be at least 1");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## Security Considerations

### Sensitive Data

The following data is considered sensitive and must NOT be included in registration:

- API key (sent via Authorization header, not in body)
- Cluster credentials
- Pod names or application details
- IP addresses of pods or services
- Environment variables
- ConfigMap or Secret contents

### Privacy-Preserving Data

The following data is safe to include:

- Operator version (public information)
- Cluster identifier (non-reversible hash)
- Kubernetes version (generally public)
- Approximate node count (not exact, for capacity planning)

### Data Minimization

Only collect data that is necessary for:
- API key validation
- Cluster identification
- Capacity planning
- Support and troubleshooting

## Testing

### Unit Tests

- Validate registration request serialization
- Validate registration response deserialization
- Test cluster identifier generation
- Test validation functions
- Test state transitions

### Integration Tests

- Successful registration flow
- Failed registration handling
- Re-registration flow
- State persistence and recovery

### Property-Based Tests

- Generate random valid requests
- Ensure all valid requests serialize correctly
- Generate random valid responses
- Ensure all valid responses deserialize correctly

