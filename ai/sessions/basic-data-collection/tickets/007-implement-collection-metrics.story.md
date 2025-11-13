---
story_id: implement-collection-metrics
session_id: basic-data-collection
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
status: pending
priority: medium
estimated_minutes: 20
---

# Implement Collection Metrics

## Objective

Add Prometheus metrics for collection health, success/failure rates, and collection duration.

## Context

Metrics provide observability for collection operations. They help monitor collection health and identify issues. Metrics should follow Prometheus conventions and be exposed via the health server.

## Implementation Steps

1. Create `src/collection/metrics.ts` with metrics definitions
2. Implement Prometheus metrics:
   - `kube9_operator_collection_total{type, status}` - Counter for collection attempts
   - `kube9_operator_collection_duration_seconds{type}` - Histogram for collection duration
   - `kube9_operator_collection_last_success{type}` - Gauge for last successful collection timestamp
3. Integrate metrics into collectors:
   - Increment counter on collection start (status="success" or "failed")
   - Record duration histogram
   - Update last success timestamp on successful collection
4. Expose metrics via health server (add `/metrics` endpoint if not already present)
5. Add logging for metric updates

## Files Affected

- `src/collection/metrics.ts` - New file: Prometheus metrics definitions
- `src/collection/collectors/cluster-metadata.ts` - Add metrics tracking
- `src/collection/collectors/resource-inventory.ts` - Add metrics tracking
- `src/health/server.ts` - Expose metrics endpoint (if needed)

## Acceptance Criteria

- [ ] `collection_total` counter tracks success/failure by type
- [ ] `collection_duration_seconds` histogram records collection duration
- [ ] `collection_last_success` gauge tracks last successful collection timestamp
- [ ] Metrics are exposed via `/metrics` endpoint
- [ ] Metrics follow Prometheus naming conventions
- [ ] Metrics are updated for both collection types

## Dependencies

- 005-implement-cluster-metadata-collector
- 006-implement-resource-inventory-collector

