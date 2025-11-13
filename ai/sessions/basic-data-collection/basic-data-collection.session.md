---
session_id: basic-data-collection
start_time: '2025-11-13T14:46:43.784Z'
status: development
problem_statement: basic data collection
changed_files:
  - path: ai/features/data-collection/cluster-metadata-collection.feature.md
    change_type: added
    scenarios_added:
      - Operator collects cluster metadata on schedule
      - Cluster metadata collection includes required fields
      - Cluster identifier is generated from cluster CA certificate
      - Cluster identifier falls back to server URL
      - Node count is approximate
      - Provider detection identifies cloud platform
      - Region and zone are collected when available
      - Collection uses random offset to distribute load
      - Collection interval is configurable via Helm values
      - Collection errors are handled gracefully
      - Collected data is stored locally for free tier
      - Collected data is transmitted for pro tier
      - Collection interval is configurable via Helm values for testing
    scenarios_modified:
      - Cluster identifier is generated from cluster CA certificate
      - Cluster identifier falls back to server URL
    scenarios_removed:
      - Collection interval is configurable via Helm values
  - path: ai/features/data-collection/resource-inventory-collection.feature.md
    change_type: added
    scenarios_added:
      - Operator collects resource inventory on schedule
      - Namespace list uses hashed identifiers
      - Pod counts include total and distribution
      - Deployment counts are aggregated
      - StatefulSet counts are aggregated
      - ReplicaSet counts are aggregated
      - Service counts include type breakdown
      - Collection includes required fields
      - Collection uses random offset to distribute load
      - Collection interval is configurable via Helm values
      - Collection errors are handled gracefully
      - Large clusters are handled efficiently
      - Collected data is stored locally for free tier
      - Collected data is transmitted for pro tier
      - Collection interval is configurable via Helm values for testing
    scenarios_removed:
      - Collection interval is configurable via Helm values
start_commit: 4550340d66942741cb4f0afd643f4674c1713993
end_time: '2025-11-13T14:56:20.430Z'
---
## Problem Statement

The kube9-operator needs to collect sanitized cluster metrics and configuration patterns to enable Pro tier features (AI-powered insights, dashboards, historical trends) while maintaining strict privacy and security boundaries. This first round focuses on establishing the foundational data collection infrastructure with the two simplest collection types: cluster metadata and resource inventory.

## Goals

1. **Implement Cluster Metadata Collection**
   - Collect Kubernetes version, cluster identifier, node count, provider, and region/zone
   - 24-hour collection interval with random offset (0-3600 seconds) to distribute load
   - Support both free tier (local storage) and pro tier (transmission to kube9-server)

2. **Implement Resource Inventory Collection**
   - Collect namespace counts/lists (with hashed identifiers), pod counts, deployment counts, statefulSet counts, replicaSet counts, and service counts by type
   - 6-hour collection interval with random offset (0-1800 seconds) to distribute load
   - Support both free tier (local storage) and pro tier (transmission to kube9-server)

3. **Establish Data Collection Infrastructure**
   - Collection scheduler with configurable intervals
   - Schema validation for all collected data
   - Error handling and retry logic
   - Metrics and observability for collection health
   - Sanitization pipeline (prepare for future, but basic sanitization for this round)

4. **Tier-Aware Collection Behavior**
   - Free tier: Collect and store locally only (no transmission)
   - Pro tier: Collect, sanitize, validate, and transmit to kube9-server
   - Graceful degradation when server is unreachable

## Approach

### Phase 1: Cluster Metadata Collection (Simplest First)

**Why Start Here:**
- Simplest data to collect (read-only cluster info)
- Changes infrequently (24h interval is sufficient)
- Low resource impact
- Establishes collection infrastructure pattern

**What to Collect:**
- Kubernetes version (from Version API)
- Cluster identifier (SHA256 hash of CA certificate or server URL)
- Approximate node count (list nodes, count only)
- Cluster provider (detect from node labels: AWS/GCP/Azure/on-premise/unknown)
- Cluster region/zone (extract from node labels if available)

**Collection Schedule:**
- Default: 86400 seconds (24 hours)
- Random offset: 0-3600 seconds per cluster to distribute load
- Configurable via Helm: `values.metrics.intervals.clusterMetadata`

**Data Schema:**
- Follows schema defined in `alto9-docs/products/kube9/data-collection/data-schema.md`
- Required fields: timestamp, collectionId, clusterId, kubernetesVersion, nodeCount
- Optional fields: provider, region, zone

### Phase 2: Resource Inventory Collection

**Why Second:**
- More complex than metadata (multiple resource types)
- More frequent collection needed (6h interval)
- Establishes pattern for counting and aggregating resources
- Foundation for future resource-config-patterns collection

**What to Collect:**
- Namespace count and list (using hashed identifiers: `namespace-[12-char-hash]`)
- Pod counts: total and distribution by namespace (hashed)
- Deployment counts: total only
- StatefulSet counts: total only
- ReplicaSet counts: total only
- Service counts: total and breakdown by type (ClusterIP, NodePort, LoadBalancer, ExternalName)

**Collection Schedule:**
- Default: 21600 seconds (6 hours)
- Random offset: 0-1800 seconds per cluster within each 6-hour window
- Configurable via Helm: `values.metrics.intervals.resourceInventory`

**Data Schema:**
- Follows schema defined in `alto9-docs/products/kube9/data-collection/data-schema.md`
- Required fields: timestamp, collectionId, clusterId, namespaces, resources
- Namespace identifiers must be hashed (no original names)
- Resource names must NOT be included (only counts)

### Implementation Strategy

1. **Collection Scheduler**
   - Background task manager for periodic collections
   - Support for random offsets per collection type
   - Configurable intervals via Helm values
   - Graceful shutdown handling

2. **Data Collection Modules**
   - Separate modules for each collection type
   - Use @kubernetes/client-node for API access
   - Efficient queries (list operations, no unnecessary watches)
   - Error handling with retry logic

3. **Schema Validation**
   - Validate all collected data against schemas
   - Ensure required fields are present
   - Validate data types and formats
   - Reject invalid collections before storage/transmission

4. **Storage and Transmission**
   - Free tier: Store locally in operator pod (temporary, for local analysis)
   - Pro tier: Sanitize, validate, and transmit to kube9-server via HTTPS POST
   - Collection payload wrapper with version, type, data, and sanitization metadata

5. **Observability**
   - Prometheus metrics for collection health
   - Logging for collection events and errors
   - Track collection success/failure rates
   - Monitor collection duration

## Key Decisions

### Collection Scope (First Round)

**Decision:** Start with Cluster Metadata and Resource Inventory only.

**Rationale:**
- These are the simplest collection types (read-only, counts only)
- Establishes infrastructure patterns for future collection types
- Resource Config Patterns, Performance Metrics, and Security Posture can follow in later sessions
- Allows incremental validation of the collection system

**Reference:** `alto9-docs/products/kube9/data-collection/collection-intervals.md`

### Collection Intervals

**Decision:** Use documented intervals (24h for metadata, 6h for inventory) with random offsets. Helm overrides allowed for testing/debugging only, with enforced minimums.

**Rationale:**
- Intervals balance data freshness with cluster load
- Random offsets prevent thundering herd problem
- Helm overrides useful for testing/debugging but must enforce minimums to prevent abuse
- Minimum intervals prevent excessive collection that could impact performance or increase costs
- Overrides are logged and reported to server for monitoring
- Follows established patterns from documentation

**Minimum Intervals:**
- Cluster Metadata: 3600 seconds (1 hour) minimum
- Resource Inventory: 1800 seconds (30 minutes) minimum

**Reference:** `alto9-docs/products/kube9/data-collection/collection-intervals.md`

### Data Sanitization

**Decision:** Implement basic sanitization (namespace hashing, no resource names) in first round. Full sanitization pipeline deferred.

**Rationale:**
- Cluster metadata and resource inventory are already low-sensitivity (counts only)
- Namespace hashing is straightforward to implement
- Full sanitization pipeline (for resource-config-patterns) can be built in later session
- Establishes sanitization pattern early

**Reference:** `alto9-docs/products/kube9/data-collection/data-collection-policy.md`

### Tier Behavior

**Decision:** Both free and pro tiers collect data. Free tier stores locally only, pro tier transmits.

**Rationale:**
- Enables future local analysis features for free tier
- Consistent collection behavior simplifies code
- Transmission is the only difference between tiers
- Aligns with data collection policy

**Reference:** `alto9-docs/products/kube9/data-collection/data-collection-policy.md`

### Schema Conformance

**Decision:** Strictly follow schemas defined in alto9-docs.

**Rationale:**
- Ensures compatibility with kube9-server
- Enables schema validation
- Provides clear contract for data structure
- Supports future schema evolution

**Reference:** `alto9-docs/products/kube9/data-collection/data-schema.md`

## Notes

### Privacy and Security Considerations

- **No PII Collection:** Cluster metadata and resource inventory contain no personally identifiable information
- **Hashed Identifiers:** Namespace identifiers are hashed to prevent identification
- **No Resource Names:** Only counts are collected, no individual resource names or details
- **Read-Only Operations:** All collections use read-only Kubernetes API calls
- **No Sensitive Data:** No secrets, credentials, or sensitive configuration values

**Reference:** `alto9-docs/products/kube9/data-collection/data-collection-policy.md`

### Performance Considerations

- **Efficient Queries:** Use list operations, avoid unnecessary watches
- **Bounded Memory:** Large clusters handled efficiently without loading all resource details
- **Minimal Impact:** Collections designed to have < 1% impact on cluster performance
- **Resource Limits:** Operator should respect Kubernetes API rate limits

**Reference:** `alto9-docs/products/kube9/data-collection/collection-intervals.md`

### Future Collection Types (Out of Scope for This Session)

- **Resource Config Patterns:** 12-hour interval, sanitized resource specs (future session)
- **Performance Metrics:** 15-minute interval, aggregated utilization (future session)
- **Security Posture:** 24-hour interval, policy counts and coverage (future session)

### Testing Considerations

- Unit tests for collection logic and schema validation
- Integration tests with Kind cluster for real API interactions
- Test both free tier (local storage) and pro tier (transmission) paths
- Test error handling and retry logic
- Test large cluster scenarios (thousands of resources)

### Configuration

- Collection intervals configurable via Helm values
- Defaults match documented intervals
- Overrides logged for monitoring
- Configuration changes require operator restart (future: hot-reload)

### Dependencies

- Requires RBAC permissions for reading cluster metadata and resources
- Pro tier requires kube9-server registration (already implemented in MVP session)
- Uses existing Kubernetes client library (@kubernetes/client-node)
- Uses existing logging infrastructure
