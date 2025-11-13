---
model_id: cluster-metadata
spec_id: [cluster-metadata-collection-spec]
---

# Cluster Metadata Model

## Schema

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

## Example

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "collectionId": "coll_abc123def45678901234567890123456",
  "clusterId": "cls_xyz789ghi01234567890123456789012",
  "kubernetesVersion": "1.28.0",
  "nodeCount": 5,
  "provider": "aws",
  "region": "us-east-1",
  "zone": "us-east-1a"
}
```

## Validation Rules

- `timestamp` must be valid ISO 8601 format
- `collectionId` must match pattern `^coll_[a-z0-9]{32}$`
- `clusterId` must match pattern `^cls_[a-z0-9]{32}$`
- `kubernetesVersion` must match pattern `^v?\\d+\\.\\d+\\.\\d+`
- `nodeCount` must be integer between 1 and 10000
- `provider` must be one of: "aws", "gcp", "azure", "on-premise", "other", "unknown"
- `region` and `zone` must be max 50 characters if present

