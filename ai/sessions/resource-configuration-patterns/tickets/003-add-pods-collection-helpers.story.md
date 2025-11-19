---
story_id: add-pods-collection-helpers
session_id: resource-configuration-patterns
feature_id: [resource-configuration-patterns-collection]
spec_id: [resource-configuration-patterns-collection-spec]
status: completed
priority: high
estimated_minutes: 30
---

## Objective

Implement helper functions to extract configuration data from pods and containers.

## Context

Pods and containers provide the majority of configuration data (resource limits, security contexts, volumes, probes). These helper functions process individual pods/containers and update the data collection structure.

## Implementation Steps

1. In `src/collection/collectors/resource-configuration-patterns.ts`, add helper functions:
   - `processContainerResources(data, containerResources)` - Extract CPU/memory limits and requests
   - `processImagePullPolicy(data, imagePullPolicy)` - Record image pull policy
   - `processContainerSecurityContext(data, securityContext)` - Extract container-level security settings
   - `processPodSecurityContext(data, securityContext)` - Extract pod-level security settings
   - `processProbes(data, container)` - Extract liveness, readiness, and startup probe configurations
   - `processVolumes(data, volumes)` - Identify volume types and count them
   - `processPodLabelsAnnotations(data, metadata)` - Count labels and annotations on pods

2. Each function should:
   - Take the data collection object and the specific resource to process
   - Extract relevant fields from the resource
   - Update appropriate arrays/counters in the data structure
   - Handle undefined/null values gracefully

## Files Affected

- `src/collection/collectors/resource-configuration-patterns.ts` - Add helper functions

## Acceptance Criteria

- [x] All 7 helper functions implemented
- [x] Functions handle undefined/null values without errors
- [x] Resource limits/requests recorded as strings (e.g., "100m", "256Mi") or null
- [x] Security context booleans tracked with true/false/notSet counters
- [x] Probe types correctly identified (http, tcp, exec, grpc)
- [x] Volume types correctly identified from volume object keys
- [x] Label/annotation counts extracted from metadata objects
- [x] TypeScript compilation succeeds

## Dependencies

- Depends on story `002-add-data-initialization-functions`

