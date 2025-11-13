---
story_id: add-helm-collection-intervals
session_id: basic-data-collection
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
status: pending
priority: medium
estimated_minutes: 15
---

# Add Helm Collection Interval Configuration

## Objective

Add Helm chart configuration for collection intervals, allowing testing/debugging overrides while enforcing minimum intervals.

## Context

Collection intervals should be configurable via Helm values for testing/debugging, but the operator enforces minimum intervals to prevent abuse. Defaults match documented intervals (24h for metadata, 6h for inventory).

## Implementation Steps

1. Update `charts/kube9-operator/values.yaml`:
   - Add `metrics.intervals.clusterMetadata` (default: 86400)
   - Add `metrics.intervals.resourceInventory` (default: 21600)
2. Update `charts/kube9-operator/values.schema.json`:
   - Add schema for `metrics.intervals` object
   - Define minimum values (3600 for metadata, 1800 for inventory)
   - Add descriptions explaining testing/debugging use case
3. Update config loader to read interval values from environment/ConfigMap
4. Update `src/config/types.ts` to include interval configuration
5. Log configured intervals (and any overrides) at startup

## Files Affected

- `charts/kube9-operator/values.yaml` - Add interval defaults
- `charts/kube9-operator/values.schema.json` - Add interval schema
- `src/config/types.ts` - Add interval configuration types
- `src/config/loader.ts` - Load interval values

## Acceptance Criteria

- [ ] Helm values include `metrics.intervals.clusterMetadata` (default: 86400)
- [ ] Helm values include `metrics.intervals.resourceInventory` (default: 21600)
- [ ] Schema validates minimum intervals (3600 for metadata, 1800 for inventory)
- [ ] Config loader reads intervals from environment/ConfigMap
- [ ] Configured intervals are logged at startup
- [ ] Operator enforces minimum intervals (handled in scheduler)

## Dependencies

- 001-implement-collection-scheduler (scheduler enforces minimums)

