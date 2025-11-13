---
story_id: update-rbac-permissions
session_id: basic-data-collection
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
status: pending
priority: high
estimated_minutes: 15
---

# Update RBAC Permissions

## Objective

Update Helm chart RBAC templates to include permissions required for data collection (reading cluster metadata and resources).

## Context

The operator needs additional RBAC permissions to read cluster metadata (version, nodes) and resources (namespaces, pods, deployments, statefulSets, replicaSets, services). These permissions should be added to the existing ClusterRole.

## Implementation Steps

1. Update `charts/kube9-operator/templates/clusterrole.yaml`
2. Add permissions for cluster metadata collection:
   - Read cluster version: `nonResourceURLs: ["/version"]` with verb `get`
   - Read nodes: `resources: ["nodes"]` with verbs `["list", "get"]`
3. Add permissions for resource inventory collection:
   - Read namespaces: `resources: ["namespaces"]` with verbs `["list", "get"]`
   - Read pods: `resources: ["pods"]` with verb `["list"]`
   - Read deployments, statefulSets, replicaSets: `apiGroups: ["apps"]`, `resources: ["deployments", "statefulsets", "replicasets"]` with verb `["list"]`
   - Read services: `resources: ["services"]` with verb `["list"]`
4. Verify existing permissions are preserved
5. Update ClusterRole documentation/comments

## Files Affected

- `charts/kube9-operator/templates/clusterrole.yaml` - Add collection permissions

## Acceptance Criteria

- [ ] ClusterRole includes permission to read `/version` endpoint
- [ ] ClusterRole includes permission to list/get nodes
- [ ] ClusterRole includes permission to list namespaces
- [ ] ClusterRole includes permission to list pods
- [ ] ClusterRole includes permission to list deployments, statefulSets, replicaSets
- [ ] ClusterRole includes permission to list services
- [ ] Existing permissions are preserved
- [ ] RBAC follows least-privilege principle (read-only operations)

## Dependencies

- None (can be done independently, but needed before collectors can run)

