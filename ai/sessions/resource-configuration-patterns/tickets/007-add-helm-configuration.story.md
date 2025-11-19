---
story_id: add-helm-configuration
session_id: resource-configuration-patterns
feature_id: [resource-configuration-patterns-collection]
spec_id: [resource-configuration-patterns-collection-spec]
status: completed
priority: medium
estimated_minutes: 15
---

## Objective

Add Helm values configuration for the resource configuration patterns collection interval.

## Context

The Helm chart needs to expose the collection interval as a configurable value for testing/debugging purposes, following the pattern established by other collectors.

## Implementation Steps

1. Open `charts/kube9-operator/values.yaml`
2. Add configuration under `metrics.intervals` section:
   ```yaml
   resourceConfigurationPatterns: 43200  # 12 hours in seconds
   ```
3. Update any relevant documentation or comments to mention the new collector

## Files Affected

- `charts/kube9-operator/values.yaml` - Add interval configuration

## Acceptance Criteria

- [x] `metrics.intervals.resourceConfigurationPatterns` set to 43200 (12 hours)
- [x] Configuration follows existing pattern from other collectors
- [x] YAML syntax is valid
- [x] helm lint passes
- [x] helm template renders correctly

## Dependencies

None (can be done in parallel with other stories)

