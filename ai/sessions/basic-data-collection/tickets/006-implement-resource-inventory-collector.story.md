---
story_id: implement-resource-inventory-collector
session_id: basic-data-collection
feature_id: [resource-inventory-collection]
spec_id: [resource-inventory-collection-spec]
diagram_id: [data-collection-flow]
status: completed
priority: high
estimated_minutes: 30
---

# Implement Resource Inventory Collector

## Objective

Implement resource inventory collection that gathers namespace counts/lists, pod counts, deployment counts, statefulSet counts, replicaSet counts, and service counts by type.

## Context

Resource inventory is collected on a 6-hour interval with random offset. This collection is more complex than metadata as it aggregates multiple resource types. Namespace identifiers must be hashed, and no resource names should be included.

## Implementation Steps

1. Create `src/collection/collectors/resource-inventory.ts` with `ResourceInventoryCollector` class
2. Implement `collect(): Promise<ResourceInventory>` method that:
   - Collects namespaces (count and hashed list)
   - Collects pod counts (total and by namespace)
   - Collects deployment counts (total)
   - Collects statefulSet counts (total)
   - Collects replicaSet counts (total)
   - Collects service counts (total and by type)
3. Implement namespace hashing function:
   - SHA256 hash of namespace name
   - Format as `namespace-[12-char-hash]`
4. Implement efficient resource counting:
   - Use list operations (not watches)
   - Aggregate counts without loading full resource details
   - Handle large clusters efficiently (consider pagination)
5. Ensure no resource names are included (only counts)
6. Generate collection ID and timestamp
7. Wrap collected data in CollectionPayload
8. Integrate with scheduler, validation, storage, and transmission

## Files Affected

- `src/collection/collectors/resource-inventory.ts` - New file: Resource inventory collector
- `src/index.ts` - Register collector with scheduler

## Acceptance Criteria

- [ ] Namespace count and hashed list are collected correctly
- [ ] Namespace identifiers use format `namespace-[12-char-hash]`
- [ ] Pod counts include total and distribution by namespace
- [ ] Deployment, statefulSet, and replicaSet counts are accurate
- [ ] Service counts include total and breakdown by type
- [ ] No resource names are included in collection
- [ ] Large clusters are handled efficiently (no memory issues)
- [ ] Collected data is validated before storage/transmission
- [ ] Free tier stores locally, pro tier transmits

## Dependencies

- 001-implement-collection-scheduler
- 002-implement-schema-validation
- 003-implement-local-storage
- 004-implement-transmission-client

