---
story_id: implement-schema-validation
session_id: basic-data-collection
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
status: completed
priority: high
estimated_minutes: 20
---

# Implement Schema Validation

## Objective

Create schema validation utilities to validate collected data against TypeScript interfaces before storage or transmission.

## Context

All collected data must be validated against schemas defined in the specs. This ensures data integrity and prevents invalid data from being stored or transmitted. Validation should check required fields, types, patterns, and ranges.

## Implementation Steps

1. Create `src/collection/validation.ts` with validation functions
2. Implement `validateClusterMetadata(data: unknown): ClusterMetadata` function
   - Check required fields: timestamp, collectionId, clusterId, kubernetesVersion, nodeCount
   - Validate types match TypeScript interface
   - Validate patterns: collectionId (`^coll_[a-z0-9]{32}$`), clusterId (`^cls_[a-z0-9]{32}$`), kubernetesVersion (`^v?\\d+\\.\\d+\\.\\d+`)
   - Validate ranges: nodeCount (1-10000), region/zone (max 50 chars)
   - Validate enum: provider must be one of allowed values
3. Implement `validateResourceInventory(data: unknown): ResourceInventory` function
   - Check required fields: timestamp, collectionId, clusterId, namespaces, resources
   - Validate types match TypeScript interface
   - Validate patterns: collectionId, clusterId, namespace identifiers (`^namespace-[a-f0-9]{12}$`)
   - Validate ranges: all counts >= 0, namespace list length matches count
   - Ensure no resource names are included
4. Create TypeScript interfaces matching spec schemas
5. Add error handling with descriptive validation error messages

## Files Affected

- `src/collection/validation.ts` - New file: Schema validation functions
- `src/collection/types.ts` - New file: TypeScript interfaces for collection data

## Acceptance Criteria

- [ ] `validateClusterMetadata` validates all required fields and types
- [ ] `validateClusterMetadata` validates patterns and ranges correctly
- [ ] `validateResourceInventory` validates all required fields and types
- [ ] `validateResourceInventory` validates namespace hashing format
- [ ] Validation functions throw descriptive errors for invalid data
- [ ] TypeScript interfaces match spec schemas exactly

## Dependencies

- None (can be implemented independently)

