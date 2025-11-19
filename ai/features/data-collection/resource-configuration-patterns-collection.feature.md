---
feature_id: resource-configuration-patterns-collection
spec_id: [resource-configuration-patterns-collection-spec]
diagram_id: [data-collection-flow]
context_id: [kubernetes-operator-development]
---

# Resource Configuration Patterns Collection Feature

## Overview

The operator collects resource configuration data from cluster workloads on a 12-hour interval. This data captures how resources are configured (limits, replicas, security contexts, volumes, etc.) and will be used for pattern analysis and insights in future phases.

## Behavior

```gherkin
Feature: Resource Configuration Patterns Collection

Background:
  Given the kube9 operator is running in a Kubernetes cluster
  And the operator has read access to cluster resources
  And the operator is configured with collection intervals

Scenario: Operator collects resource configuration data on schedule
  Given the operator has been running for at least 12 hours
  When the resource configuration patterns collection interval elapses
  Then the operator should collect resource configuration data
  And the collection should include resource limits and requests
  And the collection should include replica counts
  And the collection should include image pull policies
  And the collection should include security contexts
  And the collection should include label and annotation usage
  And the collection should include volume types
  And the collection should include service types
  And the collection should include probe configurations

Scenario: Resource limits and requests are collected
  Given the operator is collecting resource configuration data
  When processing pods and containers
  Then it should extract CPU request values from each container
  And it should extract CPU limit values from each container
  And it should extract memory request values from each container
  And it should extract memory limit values from each container
  And it should record when limits or requests are not set
  And container names should NOT be included

Scenario: Replica counts are collected
  Given the operator is collecting resource configuration data
  When processing deployments, statefulSets, and daemonSets
  Then it should extract replica count from each deployment
  And it should extract replica count from each statefulSet
  And it should record daemonSet presence (no replica count)
  And resource names should NOT be included

Scenario: Image pull policies are collected
  Given the operator is collecting resource configuration data
  When processing containers
  Then it should extract imagePullPolicy from each container
  And it should record Always, IfNotPresent, or Never values
  And it should record when imagePullPolicy is not set
  And image names should NOT be included

Scenario: Security contexts are collected
  Given the operator is collecting resource configuration data
  When processing pods and containers
  Then it should extract runAsNonRoot setting from security contexts
  And it should extract readOnlyRootFilesystem setting from security contexts
  And it should extract allowPrivilegeEscalation setting from security contexts
  And it should extract capabilities from security contexts
  And it should record when security contexts are not set
  And it should record both pod-level and container-level security contexts

Scenario: Label and annotation usage is collected
  Given the operator is collecting resource configuration data
  When processing resources with labels and annotations
  Then it should count the number of labels per resource type
  And it should count the number of annotations per resource type
  And it should record common label keys (app, version, component, etc.)
  And label values should NOT be included
  And annotation values should NOT be included

Scenario: Volume types are collected
  Given the operator is collecting resource configuration data
  When processing pods with volumes
  Then it should record volume types used (configMap, secret, emptyDir, persistentVolumeClaim, etc.)
  And it should count volumes per pod
  And it should count volume mounts per container
  And volume names should NOT be included
  And volume content should NOT be included

Scenario: Service types are collected
  Given the operator is collecting resource configuration data
  When processing services
  Then it should record service type (ClusterIP, NodePort, LoadBalancer, ExternalName)
  And it should count the number of ports per service
  And service names should NOT be included
  And service IPs should NOT be included
  And endpoint addresses should NOT be included

Scenario: Probe configurations are collected
  Given the operator is collecting resource configuration data
  When processing containers with probes
  Then it should record when liveness probes are configured
  And it should record when readiness probes are configured
  And it should record when startup probes are configured
  And it should record probe types (http, tcp, exec, grpc)
  And it should extract initialDelaySeconds from probes
  And it should extract timeoutSeconds from probes
  And it should extract periodSeconds from probes
  And probe URLs should NOT be included
  And probe commands should NOT be included

Scenario: Collection includes required metadata fields
  Given the operator is collecting resource configuration data
  When the collection completes
  Then the data should include timestamp in ISO 8601 format
  And the data should include collectionId with format "coll_[32-char-hash]"
  And the data should include clusterId with format "cls_[32-char-hash]"
  And the data should include all configuration categories

Scenario: Collection uses random offset to distribute load
  Given multiple operators are running in different clusters
  When scheduling resource configuration patterns collection
  Then each operator should use a random offset between 0 and 3600 seconds
  And the offset should be consistent for each operator instance
  And collections should be distributed across the 12-hour window

Scenario: Collection interval is configurable via Helm values for testing
  Given the operator is installed via Helm
  When configuring collection intervals
  Then the resourceConfigurationPatterns interval should default to 43200 seconds (12 hours)
  And the interval should be configurable via values.metrics.intervals.resourceConfigurationPatterns for testing/debugging
  And the operator should enforce a minimum interval of 3600 seconds (1 hour)
  And intervals shorter than the minimum should be rejected
  And the configured interval should be logged for monitoring
  And Helm overrides should be reported to kube9-server for monitoring

Scenario: Collection errors are handled gracefully
  Given the operator is collecting resource configuration data
  When an error occurs during collection
  Then the operator should log the error with details
  And the operator should continue with partial data if possible
  And the operator should retry after the next interval
  And the operator should not crash or stop operating
  And the error should be tracked in collection metrics

Scenario: Large clusters are handled efficiently
  Given the cluster has thousands of resources
  When collecting resource configuration data
  Then the operator should use efficient list queries
  And the operator should process resources in batches
  And the collection should complete within reasonable time
  And memory usage should remain bounded
  And CPU usage should stay within resource limits

Scenario: Collected data is stored for verification
  Given the operator is collecting resource configuration data
  When the collection completes successfully
  Then the data should be stored locally in the operator pod
  And the data should be verifiable for correctness
  And the data should be accessible for status reporting
  And storage should not grow unbounded over time
```

## Integration Points

- **Kubernetes API**: Reads pods, deployments, statefulSets, daemonSets, replicaSets, services, and their configurations
- **Local Storage**: Stores collected data in operator pod for verification
- **Collection Scheduler**: Manages periodic collection intervals with randomization

## Non-Goals

- Real-time configuration updates (12h interval is sufficient)
- Historical configuration tracking (future feature)
- Configuration change detection (future feature)
- Data aggregation and pattern analysis (future phase - this feature focuses on collection only)
- Data transmission to kube9-server (future feature)
- Data sanitization and PII removal (future feature)


