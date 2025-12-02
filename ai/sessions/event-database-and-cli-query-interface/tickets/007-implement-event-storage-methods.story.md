---
story_id: 007-implement-event-storage-methods
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: completed
---

# Story: Implement Event Storage Methods

## Objective

Create methods in `EventRepository` for inserting events into the database with proper error handling.

## Acceptance Criteria

- [ ] `EventRepository` class created
- [ ] `insertEvent()` method accepts event object and stores in DB
- [ ] Handles duplicate ID errors gracefully (PRIMARY KEY constraint)
- [ ] Validates event fields with Zod schema
- [ ] Serializes metadata to JSON string
- [ ] Returns success/failure indication
- [ ] Logs errors without crashing

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/event-repository.ts`
- `/home/danderson/code/alto9/opensource/kube9-operator/src/types/event.ts`

## Implementation Notes

### Event Types

```typescript
// src/types/event.ts
import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'cluster',
  'operator',
  'insight',
  'assessment',
  'health',
  'system'
]);

export const SeveritySchema = z.enum([
  'info',
  'warning',
  'error',
  'critical'
]);

export const EventSchema = z.object({
  id: z.string(),
  event_type: EventTypeSchema,
  severity: SeveritySchema,
  title: z.string().max(200),
  description: z.string().max(1000).optional(),
  object_kind: z.string().optional(),
  object_namespace: z.string().optional(),
  object_name: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
});

export type Event = z.infer<typeof EventSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type SeverityLevel = z.infer<typeof SeveritySchema>;
```

### EventRepository Class

```typescript
// src/database/event-repository.ts
import { DatabaseManager } from './manager.js';
import { Event, EventSchema } from '../types/event.js';
import Database from 'better-sqlite3';

export class EventRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  public insertEvent(event: Event): boolean {
    try {
      // Validate event with Zod
      const validated = EventSchema.parse(event);

      // Prepare insert statement
      const stmt = this.db.prepare(`
        INSERT INTO events (
          id, event_type, severity, title, description,
          object_kind, object_namespace, object_name,
          metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Serialize metadata to JSON
      const metadataJson = validated.metadata 
        ? JSON.stringify(validated.metadata) 
        : null;

      // Execute insert
      stmt.run(
        validated.id,
        validated.event_type,
        validated.severity,
        validated.title,
        validated.description || null,
        validated.object_kind || null,
        validated.object_namespace || null,
        validated.object_name || null,
        metadataJson,
        validated.created_at
      );

      return true;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        // Duplicate event ID
        console.error(`Duplicate event ID: ${event.id}`);
        return false;
      } else {
        console.error('Failed to insert event:', error.message);
        return false;
      }
    }
  }
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 004 (DatabaseManager)
- Story 005 (Schema must exist)
- Story 006 (Event ID generation)

