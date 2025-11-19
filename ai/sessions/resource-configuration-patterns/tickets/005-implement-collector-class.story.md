---
story_id: implement-collector-class
session_id: resource-configuration-patterns
feature_id: [resource-configuration-patterns-collection]
spec_id: [resource-configuration-patterns-collection-spec]
diagram_id: [data-collection-flow]
status: completed
priority: high
estimated_minutes: 30
---

## Objective

Implement the `ResourceConfigurationPatternsCollector` class with collect() and processCollection() methods.

## Context

The collector class orchestrates the entire collection process following the pattern established by `ClusterMetadataCollector`. It queries the Kubernetes API, processes resources using helper functions, and stores the results.

## Implementation Steps

1. In `src/collection/collectors/resource-configuration-patterns.ts`, create the `ResourceConfigurationPatternsCollector` class
2. Constructor should accept:
   - `kubernetesClient: KubernetesClient`
   - `localStorage: LocalStorage`
   - `transmissionClient: TransmissionClient | null`
   - `config: Config`
3. Implement `async collect()` method:
   - Initialize data structure using init functions
   - Call `listPodForAllNamespaces()` and process each pod with helper functions
   - Call `listDeploymentForAllNamespaces()` and extract replica counts + labels/annotations
   - Call `listStatefulSetForAllNamespaces()` and extract replica counts
   - Call `listDaemonSetForAllNamespaces()` and count them
   - Call `listServiceForAllNamespaces()` and process service types + labels/annotations
   - Generate collectionId and clusterId
   - Create timestamp
   - Log collection success with summary metrics
   - Return collected data
4. Implement `async processCollection(data)` method following the pattern from ClusterMetadataCollector:
   - Validate collected data (can be minimal for now)
   - Wrap in CollectionPayload
   - Store locally (free tier transmission comes later)
   - Log processing success
   - Handle errors gracefully
5. Add private `generateCollectionId()` method (same as ClusterMetadataCollector)

## Files Affected

- `src/collection/collectors/resource-configuration-patterns.ts` - Add collector class

## Acceptance Criteria

- [x] Class follows pattern from `ClusterMetadataCollector`
- [x] `collect()` method queries all necessary Kubernetes APIs
- [x] All helper functions are called appropriately for their resource types
- [x] Collection ID generated in format `coll_[32-char-hash]`
- [x] Cluster ID retrieved using `generateClusterIdForCollection()`
- [x] Timestamp in ISO 8601 format
- [x] `processCollection()` stores data locally
- [x] Logging provides useful information (collection start, success, duration, counts)
- [x] Error handling prevents crashes
- [x] TypeScript compilation succeeds

## Dependencies

- Depends on stories `003-add-pods-collection-helpers` and `004-add-workload-service-helpers`

