---
story_id: implement-collection-scheduler
session_id: basic-data-collection
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
diagram_id: [data-collection-flow]
status: pending
priority: high
estimated_minutes: 25
---

# Implement Collection Scheduler

## Objective

Create a collection scheduler infrastructure that manages periodic data collection tasks with configurable intervals, random offsets, and graceful shutdown support.

## Context

The collection scheduler is the foundation for all data collection. It needs to support multiple collection types (cluster metadata, resource inventory) with different intervals (24h and 6h respectively), random offsets to distribute load, and proper lifecycle management.

## Implementation Steps

1. Create `src/collection/scheduler.ts` with a `CollectionScheduler` class
2. Implement support for registering collection tasks with:
   - Collection type identifier
   - Interval in seconds (with minimum enforcement)
   - Random offset range
   - Collection callback function
3. Implement random offset generation per collection type (consistent per instance)
4. Implement start/stop methods for lifecycle management
5. Add graceful shutdown support (stop all scheduled collections)
6. Add logging for scheduler lifecycle events

## Files Affected

- `src/collection/scheduler.ts` - New file: Collection scheduler implementation
- `src/index.ts` - Initialize scheduler and register collection tasks

## Acceptance Criteria

- [ ] Scheduler can register multiple collection tasks with different intervals
- [ ] Random offsets are generated per collection type (0-3600s for metadata, 0-1800s for inventory)
- [ ] Minimum intervals are enforced (3600s for metadata, 1800s for inventory)
- [ ] Collections are scheduled with initial offset delay, then repeat at interval
- [ ] Scheduler supports graceful shutdown (stops all timers)
- [ ] Scheduler logs lifecycle events (start, stop, collection scheduled)

## Dependencies

- None (foundational infrastructure)

