---
story_id: 006-implement-event-id-generation
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage, event-recording]
spec_id: [event-database-schema-spec]
status: pending
---

# Story: Implement Event ID Generation

## Objective

Create a function that generates sortable, timestamp-based event IDs in the format `evt_YYYYMMDD_HHMMSS_<random>`.

## Acceptance Criteria

- [ ] `generateEventId()` function created
- [ ] Generates IDs in format `evt_YYYYMMDD_HHMMSS_<random>`
- [ ] Random suffix is 6 alphanumeric characters
- [ ] IDs sort chronologically when compared lexicographically
- [ ] Unit test verifies format and uniqueness

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/event-id.ts`

## Implementation Notes

### Event ID Generator

```typescript
import { randomBytes } from 'crypto';

/**
 * Generates a sortable event ID with format: evt_YYYYMMDD_HHMMSS_<random>
 * 
 * Examples:
 * - evt_20251202_103045_a7f3b9
 * - evt_20251202_103046_x9y8z7
 * 
 * The timestamp portion ensures chronological sorting.
 * The random suffix prevents collisions.
 */
export function generateEventId(): string {
  const now = new Date();
  
  // Format: YYYYMMDD
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Format: HHMMSS
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  
  // Generate 6-character random suffix (alphanumeric lowercase)
  const random = randomBytes(3).toString('hex');
  
  return `evt_${date}_${time}_${random}`;
}

/**
 * Validates an event ID format
 */
export function isValidEventId(id: string): boolean {
  const pattern = /^evt_\d{8}_\d{6}_[a-f0-9]{6}$/;
  return pattern.test(id);
}
```

### Example Usage

```typescript
const eventId = generateEventId();
// evt_20251202_103045_a7f3b9

// IDs are chronologically sortable
const id1 = generateEventId();
// wait a moment
const id2 = generateEventId();
// id1 < id2 (lexicographically)
```

## Estimated Time

< 15 minutes

## Dependencies

None - standalone utility function

