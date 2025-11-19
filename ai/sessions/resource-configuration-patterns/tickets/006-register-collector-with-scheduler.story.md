---
story_id: register-collector-with-scheduler
session_id: resource-configuration-patterns
feature_id: [resource-configuration-patterns-collection]
spec_id: [resource-configuration-patterns-collection-spec]
status: pending
priority: high
estimated_minutes: 20
---

## Objective

Register the resource configuration patterns collector with the collection scheduler in the main entry point.

## Context

The collector must be registered with the scheduler to run on the configured 12-hour interval. This follows the pattern established by the cluster-metadata and resource-inventory collectors.

## Implementation Steps

1. Open `src/index.ts` (or wherever collectors are registered)
2. Import the new `ResourceConfigurationPatternsCollector`
3. Instantiate the collector with necessary dependencies (kubernetesClient, localStorage, transmissionClient, config)
4. Register with scheduler using:
   - Type: `'resource-configuration-patterns'`
   - Interval: From config (default 43200 seconds / 12 hours)
   - Min interval: 3600 seconds (1 hour)
   - Offset range: 3600 seconds (1 hour)
   - Callback: async function that calls `collector.collect()` then `collector.processCollection(data)`
5. Add logging for collector registration

## Files Affected

- `src/index.ts` - Import and register new collector

## Acceptance Criteria

- [ ] Collector imported from `./collection/collectors/resource-configuration-patterns.js`
- [ ] Collector instantiated with all required dependencies
- [ ] Scheduler registration uses correct intervals (12h default, 1h minimum, 1h offset range)
- [ ] Callback properly chains collect() and processCollection()
- [ ] Registration follows existing pattern from other collectors
- [ ] TypeScript compilation succeeds
- [ ] Operator starts without errors

## Dependencies

- Depends on story `005-implement-collector-class`

