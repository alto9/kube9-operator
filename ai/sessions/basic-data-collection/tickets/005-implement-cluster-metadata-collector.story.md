---
story_id: implement-cluster-metadata-collector
session_id: basic-data-collection
feature_id: [cluster-metadata-collection]
spec_id: [cluster-metadata-collection-spec]
diagram_id: [data-collection-flow]
status: pending
priority: high
estimated_minutes: 30
---

# Implement Cluster Metadata Collector

## Objective

Implement cluster metadata collection that gathers Kubernetes version, cluster identifier, node count, provider, and region/zone information.

## Context

Cluster metadata is collected on a 24-hour interval with random offset. This is the simplest collection type and establishes the pattern for other collectors. Data must be validated and either stored locally (free tier) or transmitted (pro tier).

## Implementation Steps

1. Create `src/collection/collectors/cluster-metadata.ts` with `ClusterMetadataCollector` class
2. Implement `collect(): Promise<ClusterMetadata>` method that:
   - Gets Kubernetes version from VersionApi
   - Generates cluster identifier (from CA cert or server URL)
   - Counts nodes from CoreV1Api
   - Detects provider from node labels
   - Extracts region/zone from node labels
   - Generates collection ID
   - Creates timestamp in ISO 8601 format
3. Implement cluster identifier generation:
   - Prefer cluster CA certificate (SHA256 hash, format as `cls_[32-char-hash]`)
   - Fallback to server URL if CA cert not available
4. Implement provider detection from node labels (AWS/GCP/Azure/on-premise/unknown)
5. Implement region/zone extraction from node labels
6. Wrap collected data in CollectionPayload with sanitization metadata
7. Integrate with scheduler, validation, storage, and transmission

## Files Affected

- `src/collection/collectors/cluster-metadata.ts` - New file: Cluster metadata collector
- `src/index.ts` - Register collector with scheduler

## Acceptance Criteria

- [ ] Collector retrieves Kubernetes version correctly
- [ ] Cluster identifier is generated from CA cert (or server URL fallback)
- [ ] Node count is accurate
- [ ] Provider detection identifies AWS/GCP/Azure/on-premise/unknown correctly
- [ ] Region and zone are extracted when available
- [ ] Collection ID follows format `coll_[32-char-hash]`
- [ ] Timestamp is ISO 8601 format
- [ ] Collected data is validated before storage/transmission
- [ ] Free tier stores locally, pro tier transmits

## Dependencies

- 001-implement-collection-scheduler
- 002-implement-schema-validation
- 003-implement-local-storage
- 004-implement-transmission-client

