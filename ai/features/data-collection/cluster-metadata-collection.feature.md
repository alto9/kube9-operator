---
feature_id: cluster-metadata-collection
spec_id: [cluster-metadata-collection-spec]
diagram_id: [data-collection-flow]
context_id: [kubernetes-operator-development]
---

# Cluster Metadata Collection Feature

## Overview

The operator collects basic cluster identification and version information on a 24-hour interval. This data is used for service provisioning, capacity planning, and version compatibility checks.

## Behavior

```gherkin
Feature: Cluster Metadata Collection

Background:
  Given the kube9 operator is running in a Kubernetes cluster
  And the operator has read access to cluster metadata
  And the operator is configured with collection intervals

Scenario: Operator collects cluster metadata on schedule
  Given the operator has been running for at least 24 hours
  When the cluster metadata collection interval elapses
  Then the operator should collect cluster metadata
  And the collection should include Kubernetes version
  And the collection should include cluster identifier
  And the collection should include approximate node count
  And the collection should include cluster provider if detectable
  And the collection should include cluster region if available
  And the collection should include cluster zone if available

Scenario: Cluster metadata collection includes required fields
  Given the operator is collecting cluster metadata
  When the collection completes
  Then the data should include timestamp in ISO 8601 format
  And the data should include collectionId with format "coll_[32-char-hash]"
  And the data should include clusterId with format "cls_[32-char-hash]"
  And the data should include kubernetesVersion matching semver pattern
  And the data should include nodeCount as an integer between 1 and 10000

Scenario: Cluster identifier is generated from cluster CA certificate
  Given the operator has access to cluster configuration
  When generating the cluster identifier
  Then it should use the cluster CA certificate data if available
  And it should create a SHA256 hash of the certificate
  And it should format the identifier as "cls_[32-char-hash]"
  And the identifier should be consistent across collections

Scenario: Cluster identifier falls back to server URL
  Given the cluster CA certificate is not available
  When generating the cluster identifier
  Then it should use the cluster server URL
  And it should create a SHA256 hash of the URL
  And it should format the identifier as "cls_[32-char-hash]"
  And the identifier should be consistent across collections

Scenario: Node count is approximate
  Given the operator is collecting cluster metadata
  When counting nodes
  Then it should count all nodes in the cluster
  And it should return the total count
  And it should not include node names or identifying information

Scenario: Provider detection identifies cloud platform
  Given the operator is collecting cluster metadata
  When detecting the cluster provider
  Then it should identify "aws" if running on AWS EKS
  And it should identify "gcp" if running on GCP GKE
  And it should identify "azure" if running on Azure AKS
  And it should identify "on-premise" if no cloud provider detected
  And it should identify "unknown" if provider cannot be determined

Scenario: Region and zone are collected when available
  Given the operator is collecting cluster metadata
  When detecting region and zone
  Then it should extract region from node labels if available
  And it should extract zone from node labels if available
  And it should set region to null if not available
  And it should set zone to null if not available

Scenario: Collection uses random offset to distribute load
  Given multiple operators are running in different clusters
  When scheduling cluster metadata collection
  Then each operator should use a random offset between 0 and 3600 seconds
  And the offset should be consistent for each operator instance
  And collections should be distributed across the 24-hour window

Scenario: Collection interval is configurable via Helm values for testing
  Given the operator is installed via Helm
  When configuring collection intervals
  Then the clusterMetadata interval should default to 86400 seconds (24 hours)
  And the interval should be configurable via values.metrics.intervals.clusterMetadata for testing/debugging
  And the operator should enforce a minimum interval of 3600 seconds (1 hour)
  And intervals shorter than the minimum should be rejected
  And the configured interval should be logged for monitoring
  And Helm overrides should be reported to kube9-server for monitoring

Scenario: Collection errors are handled gracefully
  Given the operator is collecting cluster metadata
  When an error occurs during collection
  Then the operator should log the error
  And the operator should retry after the next interval
  And the operator should not crash or stop operating
  And the error should be tracked in collection metrics

Scenario: Collected data is stored locally for free tier
  Given the operator is running in free tier (operated mode)
  When cluster metadata is collected
  Then the data should be stored locally in the operator pod
  And the data should NOT be transmitted to kube9-server
  And the data should be available for local analysis only

Scenario: Collected data is transmitted for pro tier
  Given the operator is running in pro tier (enabled mode)
  And the operator has successfully registered with kube9-server
  When cluster metadata is collected
  Then the data should be sanitized before transmission
  And the data should be validated against schema
  And the data should be transmitted to kube9-server via HTTPS POST
  And the data should conform to the cluster-metadata schema
  And the transmission should include API key authentication
```

## Integration Points

- **Kubernetes API**: Reads cluster version, nodes, and node metadata
- **kube9-server**: Receives sanitized metadata (pro tier only)
- **Local Storage**: Stores data temporarily in operator pod (free tier)
- **Collection Scheduler**: Manages periodic collection intervals

## Non-Goals

- Real-time metadata updates (24h interval is sufficient)
- Detailed node information (only counts)
- Historical metadata tracking (future feature)
- Metadata from other cluster components (future feature)

