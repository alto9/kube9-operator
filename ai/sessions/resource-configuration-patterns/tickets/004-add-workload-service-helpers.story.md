---
story_id: add-workload-service-helpers
session_id: resource-configuration-patterns
feature_id: [resource-configuration-patterns-collection]
spec_id: [resource-configuration-patterns-collection-spec]
status: completed
priority: high
estimated_minutes: 20
---

## Objective

Implement helper functions to extract configuration data from deployments, statefulSets, daemonSets, and services.

## Context

Deployments, statefulSets, and services provide configuration data about replicas, service types, and labels/annotations. These helpers process workload resources and update the data collection structure.

## Implementation Steps

1. In `src/collection/collectors/resource-configuration-patterns.ts`, add helper functions:
   - `processLabelsAnnotations(data, resourceType, metadata)` - Count labels/annotations for deployments and services
   - `processServiceType(data, serviceType)` - Record service type distribution

2. Functions should:
   - Extract replica counts from workload specs
   - Count labels and annotations from metadata
   - Identify service types and count ports
   - Handle undefined values gracefully

## Files Affected

- `src/collection/collectors/resource-configuration-patterns.ts` - Add helper functions

## Acceptance Criteria

- [ ] `processLabelsAnnotations` handles 'deployments' and 'services' resource types
- [ ] Replica counts recorded in appropriate arrays (deployments vs statefulSets)
- [ ] DaemonSet count incremented correctly
- [ ] Service types counted (ClusterIP, NodePort, LoadBalancer, ExternalName)
- [ ] Port counts per service recorded in array
- [ ] Functions handle undefined/null values without errors
- [ ] TypeScript compilation succeeds

## Dependencies

- Depends on story `002-add-data-initialization-functions`

