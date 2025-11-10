---
story_id: setup-kubernetes-client
session_id: mvp
feature_id: [status-exposure]
spec_id: [status-api-spec]
model_id: []
status: pending
priority: high
estimated_minutes: 20
---

## Objective

Configure the Kubernetes client to connect to the cluster using in-cluster configuration.

## Context

The operator runs inside the Kubernetes cluster and needs to authenticate using the service account token mounted into the pod. This is foundational for all cluster interactions.

## Implementation Steps

1. Create `src/kubernetes/client.ts`
2. Import `@kubernetes/client-node`
3. Create `KubernetesClient` class that:
   - Loads in-cluster config via `kc.loadFromCluster()`
   - Creates and exports CoreV1Api client
   - Creates and exports VersionApi client
   - Includes error handling for failed initialization

4. Add method `getClusterInfo()` that returns:
   - Kubernetes version
   - Approximate node count

5. Export singleton instance of the client

## Files Affected

- `src/kubernetes/client.ts` (create)
- `src/index.ts` (import and test client)

## Acceptance Criteria

- [ ] Client successfully initializes with in-cluster config
- [ ] `getClusterInfo()` returns version and node count
- [ ] Graceful error handling if cluster is unreachable
- [ ] Client is exported as singleton

## Dependencies

- setup-nodejs-project

