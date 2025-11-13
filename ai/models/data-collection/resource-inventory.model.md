---
model_id: resource-inventory
spec_id: [resource-inventory-collection-spec]
---

# Resource Inventory Model

## Schema

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

## Example

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "collectionId": "coll_abc123def45678901234567890123456",
  "clusterId": "cls_xyz789ghi01234567890123456789012",
  "namespaces": {
    "count": 10,
    "list": ["namespace-a1b2c3d4e5f6", "namespace-9z8y7x6w5v4"]
  },
  "resources": {
    "pods": {
      "total": 150,
      "byNamespace": {
        "namespace-a1b2c3d4e5f6": 50,
        "namespace-9z8y7x6w5v4": 100
      }
    },
    "deployments": {
      "total": 25
    },
    "statefulSets": {
      "total": 5
    },
    "replicaSets": {
      "total": 30
    },
    "services": {
      "total": 40,
      "byType": {
        "ClusterIP": 35,
        "NodePort": 3,
        "LoadBalancer": 2
      }
    }
  }
}
```

## Validation Rules

- `timestamp` must be valid ISO 8601 format
- `collectionId` must match pattern `^coll_[a-z0-9]{32}$`
- `clusterId` must match pattern `^cls_[a-z0-9]{32}$`
- `namespaces.count` must match `namespaces.list.length`
- All namespace identifiers must match pattern `^namespace-[a-f0-9]{12}$`
- All resource counts must be >= 0
- `resources.pods.byNamespace` keys must be hashed namespace identifiers
- `resources.services.byType` keys must be valid service types

## Privacy Constraints

- **No Original Names**: Namespace names are hashed, original names never included
- **No Resource Names**: Only counts are collected, no individual resource names
- **No Identifying Data**: No IPs, endpoints, or other identifying information

