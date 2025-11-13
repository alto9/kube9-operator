---
spec_id: resource-inventory-collection-spec
feature_id: [resource-inventory-collection]
diagram_id: [data-collection-flow]
context_id: [kubernetes-operator-development]
---

# Resource Inventory Collection Specification

## Overview

This specification defines the technical contract for collecting resource inventory on a 6-hour interval. The collection includes namespace counts/lists, pod counts, deployment counts, statefulSet counts, replicaSet counts, and service counts by type.

## Collection Interval

| Property | Value |
|----------|-------|
| Default Interval | 21600 seconds (6 hours) |
| Minimum Interval | 1800 seconds (30 minutes) - enforced for Helm overrides |
| Random Offset Range | 0-1800 seconds (0-30 minutes) |
| Configurable Via | `values.metrics.intervals.resourceInventory` (testing/debugging only) |
| Collection Type | `resource-inventory` |

**Note:** Helm interval overrides are intended for testing and debugging only. The operator enforces minimum intervals to prevent excessive collection frequency that could impact cluster performance or increase data transmission costs. Overrides are logged and reported to kube9-server for monitoring.

## Data Schema

The collected data must conform to the following schema:

```typescript
interface ResourceInventory {
  // ISO 8601 timestamp of collection
  timestamp: string;
  
  // Unique identifier for this collection
  collectionId: string; // Format: "coll_[a-z0-9]{32}"
  
  // Server-assigned cluster identifier (or locally generated)
  clusterId: string; // Format: "cls_[a-z0-9]{32}"
  
  // Namespace information
  namespaces: {
    count: number; // Integer, minimum: 0
    list: string[]; // Array of hashed namespace identifiers: "namespace-[12-char-hash]"
  };
  
  // Resource counts
  resources: {
    pods: {
      total: number; // Integer, minimum: 0
      byNamespace: Record<string, number>; // Key: hashed namespace, Value: pod count
    };
    deployments: {
      total: number; // Integer, minimum: 0
    };
    statefulSets: {
      total: number; // Integer, minimum: 0
    };
    replicaSets: {
      total: number; // Integer, minimum: 0
    };
    services: {
      total: number; // Integer, minimum: 0
      byType: {
        ClusterIP?: number;
        NodePort?: number;
        LoadBalancer?: number;
        ExternalName?: number;
      };
    };
  };
}
```

## Collection Payload

All collections are wrapped in a collection payload:

```typescript
interface CollectionPayload {
  version: string; // Schema version (e.g., "v1.0.0")
  type: "resource-inventory";
  data: ResourceInventory;
  sanitization: {
    rulesApplied: string[];
    timestamp: string; // ISO 8601 timestamp
  };
}
```

## Kubernetes API Usage

### Collecting Namespaces

```typescript
async function collectNamespaces(coreApi: k8s.CoreV1Api): Promise<{ count: number; list: string[] }> {
  const namespaceList = await coreApi.listNamespace();
  
  const hashedNamespaces = namespaceList.items.map(ns => {
    const name = ns.metadata?.name || '';
    const hash = createHash('sha256').update(name).digest('hex').substring(0, 12);
    return `namespace-${hash}`;
  });
  
  return {
    count: namespaceList.items.length,
    list: hashedNamespaces
  };
}
```

### Collecting Pod Counts

```typescript
async function collectPodCounts(coreApi: k8s.CoreV1Api): Promise<{ total: number; byNamespace: Record<string, number> }> {
  const podList = await coreApi.listPodForAllNamespaces();
  
  const byNamespace: Record<string, number> = {};
  
  podList.items.forEach(pod => {
    const namespace = pod.metadata?.namespace || '';
    const hash = createHash('sha256').update(namespace).digest('hex').substring(0, 12);
    const namespaceId = `namespace-${hash}`;
    byNamespace[namespaceId] = (byNamespace[namespaceId] || 0) + 1;
  });
  
  return {
    total: podList.items.length,
    byNamespace
  };
}
```

### Collecting Deployment Counts

```typescript
async function collectDeploymentCounts(appsApi: k8s.AppsV1Api): Promise<{ total: number }> {
  const deploymentList = await appsApi.listDeploymentForAllNamespaces();
  return {
    total: deploymentList.items.length
  };
}
```

### Collecting StatefulSet Counts

```typescript
async function collectStatefulSetCounts(appsApi: k8s.AppsV1Api): Promise<{ total: number }> {
  const statefulSetList = await appsApi.listStatefulSetForAllNamespaces();
  return {
    total: statefulSetList.items.length
  };
}
```

### Collecting ReplicaSet Counts

```typescript
async function collectReplicaSetCounts(appsApi: k8s.AppsV1Api): Promise<{ total: number }> {
  const replicaSetList = await appsApi.listReplicaSetForAllNamespaces();
  return {
    total: replicaSetList.items.length
  };
}
```

### Collecting Service Counts

```typescript
async function collectServiceCounts(coreApi: k8s.CoreV1Api): Promise<{ total: number; byType: Record<string, number> }> {
  const serviceList = await coreApi.listServiceForAllNamespaces();
  
  const byType: Record<string, number> = {};
  
  serviceList.items.forEach(service => {
    const type = service.spec?.type || 'ClusterIP';
    byType[type] = (byType[type] || 0) + 1;
  });
  
  return {
    total: serviceList.items.length,
    byType
  };
}
```

## Namespace Hashing

```typescript
import { createHash } from 'crypto';

function hashNamespace(name: string): string {
  const hash = createHash('sha256')
    .update(name)
    .digest('hex')
    .substring(0, 12);
  return `namespace-${hash}`;
}
```

## Scheduling with Random Offset

```typescript
class ResourceInventoryCollector {
  private offsetSeconds: number;
  private intervalSeconds: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  
  constructor(intervalSeconds: number = 21600) {
    // Enforce minimum interval of 30 minutes (1800 seconds)
    const MIN_INTERVAL = 1800;
    if (intervalSeconds < MIN_INTERVAL) {
      logger.warn(`Resource inventory interval ${intervalSeconds}s is below minimum ${MIN_INTERVAL}s, using minimum`);
      this.intervalSeconds = MIN_INTERVAL;
    } else {
      this.intervalSeconds = intervalSeconds;
    }
    // Generate random offset between 0 and 1800 seconds (30 minutes)
    this.offsetSeconds = Math.floor(Math.random() * 1800);
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
      const inventory = await this.collectInventory();
      await this.processCollection(inventory);
    } catch (error) {
      logger.error('Resource inventory collection failed', { error });
    }
  }
}
```

## Validation Rules

1. **Required Fields**: timestamp, collectionId, clusterId, namespaces, resources must be present
2. **Type Checking**: All values must match declared types
3. **Pattern Matching**: 
   - collectionId must match pattern `^coll_[a-z0-9]{32}$`
   - clusterId must match pattern `^cls_[a-z0-9]{32}$`
   - Namespace identifiers must match pattern `^namespace-[a-f0-9]{12}$`
4. **Range Validation**: 
   - All counts must be >= 0
   - Namespace list length must match namespace count
5. **No Resource Names**: Resource names must NOT be included in collection

## Error Handling

### Kubernetes API Errors

```typescript
try {
  const namespaceList = await coreApi.listNamespace();
} catch (error) {
  if (error.statusCode === 403) {
    logger.error('Insufficient permissions to read namespaces');
    throw new Error('RBAC permissions required for namespace access');
  }
  throw error;
}
```

### Large Cluster Handling

```typescript
// For very large clusters, use pagination or limit queries
async function collectPodCountsEfficiently(coreApi: k8s.CoreV1Api): Promise<{ total: number; byNamespace: Record<string, number> }> {
  // Use limit to avoid loading all pods at once
  const limit = 500;
  let continueToken: string | undefined;
  let total = 0;
  const byNamespace: Record<string, number> = {};
  
  do {
    const response = await coreApi.listPodForAllNamespaces(
      undefined, // allowWatchBookmarks
      undefined, // continue
      undefined, // fieldSelector
      undefined, // labelSelector
      limit, // limit
      undefined, // resourceVersion
      continueToken // resourceVersionMatch
    );
    
    response.body.items.forEach(pod => {
      const namespace = pod.metadata?.namespace || '';
      const hash = createHash('sha256').update(namespace).digest('hex').substring(0, 12);
      const namespaceId = `namespace-${hash}`;
      byNamespace[namespaceId] = (byNamespace[namespaceId] || 0) + 1;
      total++;
    });
    
    continueToken = response.body.metadata?.continue;
  } while (continueToken);
  
  return { total, byNamespace };
}
```

## RBAC Requirements

The operator needs these permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube9-operator-inventory
rules:
# Read namespaces
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["list", "get"]
# Read pods
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["list"]
# Read deployments, statefulsets, replicasets
- apiGroups: ["apps"]
  resources: ["deployments", "statefulsets", "replicasets"]
  verbs: ["list"]
# Read services
- apiGroups: [""]
  resources: ["services"]
  verbs: ["list"]
```

## Metrics

The operator should expose Prometheus metrics:

```
kube9_operator_collection_total{type="resource-inventory",status="success"} 1460
kube9_operator_collection_total{type="resource-inventory",status="failed"} 3
kube9_operator_collection_duration_seconds{type="resource-inventory",quantile="0.95"} 2.5
kube9_operator_collection_last_success{type="resource-inventory"} 1705315200
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

- Hash namespace names correctly
- Count resources accurately
- Aggregate counts by namespace
- Count services by type
- Validate schema conformance

### Integration Tests

- Collect inventory from real Kubernetes cluster
- Verify all required fields are present
- Verify namespace hashing
- Verify no resource names are included
- Test error handling for API failures
- Test scheduling with random offset
- Test large cluster scenarios

