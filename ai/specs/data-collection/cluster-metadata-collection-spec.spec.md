---
spec_id: cluster-metadata-collection-spec
feature_id: [cluster-metadata-collection]
diagram_id: [data-collection-flow]
context_id: [kubernetes-operator-development]
---

# Cluster Metadata Collection Specification

## Overview

This specification defines the technical contract for collecting cluster metadata on a 24-hour interval. The collection includes Kubernetes version, cluster identifier, node count, provider, and region information.

## Collection Interval

| Property | Value |
|----------|-------|
| Default Interval | 86400 seconds (24 hours) |
| Minimum Interval | 3600 seconds (1 hour) - enforced for Helm overrides |
| Random Offset Range | 0-3600 seconds (0-1 hour) |
| Configurable Via | `values.metrics.intervals.clusterMetadata` (testing/debugging only) |
| Collection Type | `cluster-metadata` |

**Note:** Helm interval overrides are intended for testing and debugging only. The operator enforces minimum intervals to prevent excessive collection frequency that could impact cluster performance or increase data transmission costs. Overrides are logged and reported to kube9-server for monitoring.

## Data Schema

The collected data must conform to the following schema:

```typescript
interface ClusterMetadata {
  // ISO 8601 timestamp of collection
  timestamp: string;
  
  // Unique identifier for this collection
  collectionId: string; // Format: "coll_[a-z0-9]{32}"
  
  // Server-assigned cluster identifier (or locally generated)
  clusterId: string; // Format: "cls_[a-z0-9]{32}"
  
  // Kubernetes version (e.g., "1.28.0")
  kubernetesVersion: string; // Pattern: "^v?\\d+\\.\\d+\\.\\d+"
  
  // Approximate number of nodes
  nodeCount: number; // Integer, minimum: 1, maximum: 10000
  
  // Cluster provider/cloud (optional)
  provider?: "aws" | "gcp" | "azure" | "on-premise" | "other" | "unknown";
  
  // Cluster region (optional)
  region?: string; // Max length: 50 characters
  
  // Cluster zone/availability zone (optional)
  zone?: string; // Max length: 50 characters
}
```

## Collection Payload

All collections are wrapped in a collection payload:

```typescript
interface CollectionPayload {
  version: string; // Schema version (e.g., "v1.0.0")
  type: "cluster-metadata";
  data: ClusterMetadata;
  sanitization: {
    rulesApplied: string[];
    timestamp: string; // ISO 8601 timestamp
  };
}
```

## Kubernetes API Usage

### Reading Cluster Version

```typescript
// Use VersionApi to get Kubernetes version
const versionApi = kc.makeApiClient(k8s.VersionApi);
const versionInfo = await versionApi.getCode();
const kubernetesVersion = versionInfo.gitVersion; // e.g., "v1.28.0"
```

### Reading Node Count

```typescript
// Use CoreV1Api to list nodes
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const nodeList = await coreApi.listNode();
const nodeCount = nodeList.items.length;
```

### Generating Cluster Identifier

```typescript
import { createHash } from 'crypto';

function generateClusterId(kc: k8s.KubeConfig): string {
  const cluster = kc.getCurrentCluster();
  
  // Prefer cluster CA certificate
  let hashInput: string;
  if (cluster.caData) {
    hashInput = cluster.caData;
  } else {
    // Fallback to server URL
    hashInput = cluster.server;
  }
  
  // Generate 32-character hash and format as cls_[hash]
  const hash = createHash('sha256')
    .update(hashInput)
    .digest('hex')
    .substring(0, 32);
  
  return `cls_${hash}`;
}
```

### Detecting Provider

```typescript
function detectProvider(nodeList: k8s.V1NodeList): "aws" | "gcp" | "azure" | "on-premise" | "other" | "unknown" {
  if (nodeList.items.length === 0) {
    return "unknown";
  }
  
  const firstNode = nodeList.items[0];
  const labels = firstNode.metadata?.labels || {};
  
  // Check for cloud provider labels
  if (labels['eks.amazonaws.com/nodegroup'] || labels['kubernetes.io/instance-type']?.includes('t3')) {
    return "aws";
  }
  
  if (labels['cloud.google.com/gke-nodepool'] || labels['cloud.google.com/gke-os-distribution']) {
    return "gcp";
  }
  
  if (labels['kubernetes.azure.com/agentpool'] || labels['kubernetes.io/role']) {
    return "azure";
  }
  
  // Check for common on-premise indicators
  if (labels['node-role.kubernetes.io/master'] || labels['node-role.kubernetes.io/control-plane']) {
    return "on-premise";
  }
  
  return "unknown";
}
```

### Extracting Region and Zone

```typescript
function extractRegionAndZone(nodeList: k8s.V1NodeList): { region?: string; zone?: string } {
  if (nodeList.items.length === 0) {
    return {};
  }
  
  const firstNode = nodeList.items[0];
  const labels = firstNode.metadata?.labels || {};
  
  // AWS: topology.kubernetes.io/region and topology.kubernetes.io/zone
  // GCP: topology.gke.io/zone
  // Azure: topology.kubernetes.io/region and topology.kubernetes.io/zone
  
  const region = labels['topology.kubernetes.io/region'] || 
                  labels['failure-domain.beta.kubernetes.io/region'];
  
  const zone = labels['topology.kubernetes.io/zone'] || 
               labels['topology.gke.io/zone'] ||
               labels['failure-domain.beta.kubernetes.io/zone'];
  
  return {
    region: region || undefined,
    zone: zone || undefined
  };
}
```

## Collection ID Generation

```typescript
import { randomBytes } from 'crypto';

function generateCollectionId(): string {
  const random = randomBytes(16).toString('hex');
  return `coll_${random}`;
}
```

## Scheduling with Random Offset

```typescript
class ClusterMetadataCollector {
  private offsetSeconds: number;
  private intervalSeconds: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  
  constructor(intervalSeconds: number = 86400) {
    // Enforce minimum interval of 1 hour (3600 seconds)
    const MIN_INTERVAL = 3600;
    if (intervalSeconds < MIN_INTERVAL) {
      logger.warn(`Cluster metadata interval ${intervalSeconds}s is below minimum ${MIN_INTERVAL}s, using minimum`);
      this.intervalSeconds = MIN_INTERVAL;
    } else {
      this.intervalSeconds = intervalSeconds;
    }
    // Generate random offset between 0 and 3600 seconds (1 hour)
    this.offsetSeconds = Math.floor(Math.random() * 3600);
  }
  
  start() {
    // Wait for initial offset
    setTimeout(() => {
      this.collect();
      // Then collect at regular intervals
      this.intervalHandle = setInterval(
        () => this.collect(),
        this.intervalSeconds * 1000
      );
    }, this.offsetSeconds * 1000);
  }
  
  private async collect() {
    try {
      const metadata = await this.collectMetadata();
      await this.processCollection(metadata);
    } catch (error) {
      logger.error('Cluster metadata collection failed', { error });
    }
  }
}
```

## Validation Rules

1. **Required Fields**: timestamp, collectionId, clusterId, kubernetesVersion, nodeCount must be present
2. **Type Checking**: All values must match declared types
3. **Pattern Matching**: 
   - collectionId must match pattern `^coll_[a-z0-9]{32}$`
   - clusterId must match pattern `^cls_[a-z0-9]{32}$`
   - kubernetesVersion must match pattern `^v?\\d+\\.\\d+\\.\\d+`
4. **Range Validation**: 
   - nodeCount must be between 1 and 10000
   - region and zone must be max 50 characters
5. **Enum Validation**: provider must be one of the allowed values

## Error Handling

### Kubernetes API Errors

```typescript
try {
  const versionInfo = await versionApi.getCode();
} catch (error) {
  if (error.statusCode === 403) {
    logger.error('Insufficient permissions to read cluster version');
    throw new Error('RBAC permissions required for Version API');
  }
  throw error;
}
```

### Collection Failures

```typescript
async function collectWithRetry(maxRetries: number = 3): Promise<ClusterMetadata> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await collectMetadata();
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error('Cluster metadata collection failed after retries', { error });
        throw error;
      }
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## RBAC Requirements

The operator needs these permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube9-operator-metadata
rules:
# Read cluster version
- apiGroups: [""]
  resources: []
  verbs: ["get"]
  nonResourceURLs: ["/version"]
# Read nodes
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["list", "get"]
```

## Metrics

The operator should expose Prometheus metrics:

```
kube9_operator_collection_total{type="cluster-metadata",status="success"} 365
kube9_operator_collection_total{type="cluster-metadata",status="failed"} 2
kube9_operator_collection_duration_seconds{type="cluster-metadata",quantile="0.95"} 0.5
kube9_operator_collection_last_success{type="cluster-metadata"} 1705315200
```

## Storage

### Free Tier (Local Storage)

```typescript
// Store in memory or temporary file system
interface LocalStorage {
  store(collection: CollectionPayload): Promise<void>;
  retrieve(collectionId: string): Promise<CollectionPayload | null>;
  listRecent(limit: number): Promise<CollectionPayload[]>;
}
```

### Pro Tier (Transmission)

```typescript
// Transmit to kube9-server
async function transmitCollection(payload: CollectionPayload): Promise<void> {
  const response = await fetch('https://api.kube9.dev/v1/collections', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Collection transmission failed: ${response.status}`);
  }
}
```

## Testing

### Unit Tests

- Generate collection ID with correct format
- Generate cluster ID from CA certificate
- Generate cluster ID from server URL fallback
- Detect provider from node labels
- Extract region and zone from node labels
- Validate schema conformance

### Integration Tests

- Collect metadata from real Kubernetes cluster
- Verify all required fields are present
- Verify data types and formats
- Test error handling for API failures
- Test scheduling with random offset

