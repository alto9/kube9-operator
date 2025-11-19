---
feature_id: resource-inventory-collection
spec_id: [resource-inventory-collection-spec]
diagram_id: [data-collection-flow]
context_id: [kubernetes-operator-development]
---

# Resource Inventory Collection Feature

## Overview

The operator collects resource counts and distribution across the cluster on a 6-hour interval. This data provides insights into cluster scale, complexity, and resource utilization patterns.

## Behavior

```gherkin
Feature: Resource Inventory Collection

Background:
  Given the kube9 operator is running in a Kubernetes cluster
  And the operator has read access to cluster resources
  And the operator is configured with collection intervals

Scenario: Operator collects resource inventory on schedule
  Given the operator has been running for at least 6 hours
  When the resource inventory collection interval elapses
  Then the operator should collect resource inventory
  And the collection should include namespace count and list
  And the collection should include pod counts
  And the collection should include deployment counts
  And the collection should include statefulSet counts
  And the collection should include replicaSet counts
  And the collection should include service counts by type

Scenario: Namespace list uses hashed identifiers
  Given the operator is collecting resource inventory
  When collecting namespace information
  Then it should count the total number of namespaces
  And it should create a list of namespace identifiers
  And each namespace identifier should use format "namespace-[12-char-hash]"
  And the hash should be derived from the namespace name
  And original namespace names should NOT be included

Scenario: Pod counts include total and distribution
  Given the operator is collecting resource inventory
  When collecting pod counts
  Then it should count the total number of pods across all namespaces
  And it should count pods per namespace using hashed namespace identifiers
  And it should store the distribution in byNamespace object
  And pod names should NOT be included

Scenario: Deployment counts are aggregated
  Given the operator is collecting resource inventory
  When collecting deployment counts
  Then it should count the total number of deployments across all namespaces
  And deployment names should NOT be included
  And deployment configurations should NOT be included

Scenario: StatefulSet counts are aggregated
  Given the operator is collecting resource inventory
  When collecting statefulSet counts
  Then it should count the total number of statefulSets across all namespaces
  And statefulSet names should NOT be included
  And statefulSet configurations should NOT be included

Scenario: ReplicaSet counts are aggregated
  Given the operator is collecting resource inventory
  When collecting replicaSet counts
  Then it should count the total number of replicaSets across all namespaces
  And replicaSet names should NOT be included
  And replicaSet configurations should NOT be included

Scenario: Service counts include type breakdown
  Given the operator is collecting resource inventory
  When collecting service counts
  Then it should count the total number of services across all namespaces
  And it should count services by type (ClusterIP, NodePort, LoadBalancer, ExternalName)
  And service names should NOT be included
  And service endpoints should NOT be included
  And service IPs should NOT be included

Scenario: Collection includes required fields
  Given the operator is collecting resource inventory
  When the collection completes
  Then the data should include timestamp in ISO 8601 format
  And the data should include collectionId with format "coll_[32-char-hash]"
  And the data should include clusterId with format "cls_[32-char-hash]"
  And the data should include namespaces object with count and list
  And the data should include resources object with all resource types

Scenario: Collection uses random offset to distribute load
  Given multiple operators are running in different clusters
  When scheduling resource inventory collection
  Then each operator should use a random offset between 0 and 1800 seconds
  And the offset should be consistent for each operator instance
  And collections should be distributed across the 6-hour window

Scenario: Collection interval is configurable via Helm values for testing
  Given the operator is installed via Helm
  When configuring collection intervals
  Then the resourceInventory interval should default to 21600 seconds (6 hours)
  And the interval should be configurable via values.metrics.intervals.resourceInventory for testing/debugging
  And the operator should enforce a minimum interval of 1800 seconds (30 minutes)
  And intervals shorter than the minimum should be rejected
  And the configured interval should be logged for monitoring
  And Helm overrides should be reported to kube9-server for monitoring

Scenario: Collection errors are handled gracefully
  Given the operator is collecting resource inventory
  When an error occurs during collection
  Then the operator should log the error
  And the operator should retry after the next interval
  And the operator should not crash or stop operating
  And the error should be tracked in collection metrics

Scenario: Large clusters are handled efficiently
  Given the cluster has thousands of resources
  When collecting resource inventory
  Then the operator should use efficient list queries
  And the operator should avoid loading all resource details
  And the collection should complete within reasonable time
  And memory usage should remain bounded

Scenario: Collected data is stored locally as raw data
  Given the operator is collecting resource inventory
  When the collection completes
  Then the raw, unsanitized data should be stored locally in the operator pod
  And the data should include actual resource counts and distributions
  And the data should NOT leave the cluster
  And the data should be available for verification and future processing
```

## Integration Points

- **Kubernetes API**: Reads namespaces, pods, deployments, statefulSets, replicaSets, and services
- **Local Storage**: Stores raw collected data in operator pod
- **Collection Scheduler**: Manages periodic collection intervals

## Non-Goals

- Real-time inventory updates (6h interval is sufficient)
- Individual resource details (only counts and distributions)
- Resource configurations (future feature: resource-config-patterns)
- Historical inventory tracking (future feature)
- Resource relationships (future feature)

