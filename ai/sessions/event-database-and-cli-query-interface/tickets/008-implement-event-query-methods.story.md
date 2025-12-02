---
story_id: 008-implement-event-query-methods
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage, cli-query-interface]
spec_id: [event-database-schema-spec]
status: pending
---

# Story: Implement Event Query Methods

## Objective

Add query methods to `EventRepository` for retrieving events with filtering, pagination, and sorting.

## Acceptance Criteria

- [ ] `getEventById()` retrieves single event
- [ ] `queryEvents()` accepts filters object
- [ ] Supports filtering by event_type, severity, date range
- [ ] Supports filtering by object (kind, namespace, name)
- [ ] Supports pagination (limit, offset)
- [ ] Orders by created_at DESC (newest first)
- [ ] Deserializes metadata JSON to object
- [ ] Returns empty array if no results

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/event-repository.ts`

## Implementation Notes

### Add Query Methods to EventRepository

```typescript
export interface EventFilters {
  event_type?: string;
  severity?: string;
  created_at_gte?: string;
  created_at_lt?: string;
  object_kind?: string;
  object_namespace?: string;
  object_name?: string;
}

export interface EventQueryOptions {
  filters?: EventFilters;
  limit?: number;
  offset?: number;
}

export class EventRepository {
  // ... existing methods ...

  public getEventById(id: string): Event | null {
    const stmt = this.db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.deserializeEvent(row);
  }

  public queryEvents(options: EventQueryOptions = {}): Event[] {
    const { filters = {}, limit = 50, offset = 0 } = options;
    
    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (filters.event_type) {
      conditions.push('event_type = ?');
      params.push(filters.event_type);
    }
    
    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }
    
    if (filters.created_at_gte) {
      conditions.push('created_at >= ?');
      params.push(filters.created_at_gte);
    }
    
    if (filters.created_at_lt) {
      conditions.push('created_at < ?');
      params.push(filters.created_at_lt);
    }
    
    if (filters.object_kind) {
      conditions.push('object_kind = ?');
      params.push(filters.object_kind);
    }
    
    if (filters.object_namespace) {
      conditions.push('object_namespace = ?');
      params.push(filters.object_namespace);
    }
    
    if (filters.object_name) {
      conditions.push('object_name = ?');
      params.push(filters.object_name);
    }
    
    // Build query
    let query = 'SELECT * FROM events';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    
    params.push(limit, offset);
    
    // Execute query
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.deserializeEvent(row));
  }

  public countEvents(filters: EventFilters = {}): number {
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Same filter logic as queryEvents
    if (filters.event_type) {
      conditions.push('event_type = ?');
      params.push(filters.event_type);
    }
    
    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }
    
    if (filters.created_at_gte) {
      conditions.push('created_at >= ?');
      params.push(filters.created_at_gte);
    }
    
    if (filters.created_at_lt) {
      conditions.push('created_at < ?');
      params.push(filters.created_at_lt);
    }
    
    if (filters.object_kind) {
      conditions.push('object_kind = ?');
      params.push(filters.object_kind);
    }
    
    if (filters.object_namespace) {
      conditions.push('object_namespace = ?');
      params.push(filters.object_namespace);
    }
    
    if (filters.object_name) {
      conditions.push('object_name = ?');
      params.push(filters.object_name);
    }
    
    let query = 'SELECT COUNT(*) as count FROM events';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    
    return result.count;
  }

  private deserializeEvent(row: any): Event {
    return {
      id: row.id,
      event_type: row.event_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      object_kind: row.object_kind,
      object_namespace: row.object_namespace,
      object_name: row.object_name,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
    };
  }
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 007 (EventRepository must exist)

