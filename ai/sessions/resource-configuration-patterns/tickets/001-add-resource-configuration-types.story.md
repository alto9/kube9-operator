---
story_id: add-resource-configuration-types
session_id: resource-configuration-patterns
feature_id: [resource-configuration-patterns-collection]
spec_id: [resource-configuration-patterns-collection-spec]
diagram_id: [data-collection-flow]
status: pending
priority: high
estimated_minutes: 25
---

## Objective

Add TypeScript type definitions for resource configuration patterns data structures to `src/collection/types.ts`.

## Context

The resource configuration patterns collector needs complete TypeScript interfaces matching the schema defined in the spec. These types will be used by the collector implementation and must match the data structures exactly as specified in the spec.

## Implementation Steps

1. Open `src/collection/types.ts`
2. Add the `ResourceConfigurationPatternsData` interface with all sub-interfaces:
   - `ResourceLimitsRequestsData`
   - `ReplicaCountsData`
   - `ImagePullPoliciesData`
   - `SecurityContextsData`
   - `LabelsAnnotationsData`
   - `VolumesData`
   - `ServicesData`
   - `ProbesData`
   - `ProbeConfigData`
3. Update the `CollectionPayload` type to include `"resource-configuration-patterns"` in the type union
4. Update the `data` field type in `CollectionPayload` to include `ResourceConfigurationPatternsData`

## Files Affected

- `src/collection/types.ts` - Add new TypeScript interfaces

## Acceptance Criteria

- [ ] All interfaces match the schema exactly as defined in `resource-configuration-patterns-collection-spec.spec.md`
- [ ] `ResourceConfigurationPatternsData` interface includes all 8 data categories
- [ ] `CollectionPayload` type union includes `"resource-configuration-patterns"`
- [ ] `CollectionPayload` data field type includes `ResourceConfigurationPatternsData`
- [ ] TypeScript compilation succeeds with no errors
- [ ] Code follows existing type definition patterns in the file

## Dependencies

None (foundational types must be added first)

