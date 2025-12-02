---
story_id: 012-implement-query-events-list-command
session_id: event-database-and-cli-query-interface
feature_id: [cli-query-interface]
spec_id: [cli-architecture-spec]
status: completed
---

# Story: Implement Query Events List Command

## Objective

Implement the `kube9-operator query events list` CLI command with filtering, pagination, and multiple output formats.

## Acceptance Criteria

- [ ] `query events list` command registered
- [ ] Supports filtering: --type, --severity, --since, --until
- [ ] Supports object filtering: --object-kind, --object-namespace, --object-name
- [ ] Supports pagination: --limit, --offset
- [ ] Supports output formats: --format (json|yaml|table)
- [ ] Validates all arguments with Zod
- [ ] Returns events with pagination metadata
- [ ] Exits with code 0 on success, 1 on error

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/cli/commands/events.ts`

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/cli/index.ts`

## Implementation Notes

### Update src/cli/index.ts

```typescript
export function createQueryCommands(): Command {
  const query = new Command('query')
    .description('Query operator data');
  
  // query status
  query
    .command('status')
    .description('Get operator status')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(queryStatus);
  
  // query events
  const events = query
    .command('events')
    .description('Query events');
  
  // query events list
  events
    .command('list')
    .description('List events with filters')
    .option('--type <type>', 'Filter by event type')
    .option('--severity <severity>', 'Filter by severity level')
    .option('--since <date>', 'Filter events since date (ISO 8601)')
    .option('--until <date>', 'Filter events until date (ISO 8601)')
    .option('--object-kind <kind>', 'Filter by object kind')
    .option('--object-namespace <namespace>', 'Filter by object namespace')
    .option('--object-name <name>', 'Filter by object name')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--offset <number>', 'Skip number of results', '0')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(listEvents);
  
  // query events get
  events
    .command('get <event-id>')
    .description('Get single event by ID')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(getEvent);
  
  return query;
}
```

### Create src/cli/commands/events.ts

```typescript
import { z } from 'zod';
import { EventRepository, EventFilters } from '../../database/event-repository.js';
import { formatOutput } from '../formatters.js';

const ListOptionsSchema = z.object({
  type: z.enum(['cluster', 'operator', 'insight', 'assessment', 'health', 'system']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  objectKind: z.string().optional(),
  objectNamespace: z.string().optional(),
  objectName: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(1000)),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()),
  format: z.enum(['json', 'yaml', 'table']),
});

export async function listEvents(options: any) {
  try {
    // Validate options
    const validated = ListOptionsSchema.parse(options);
    
    // Build filters
    const filters: EventFilters = {};
    if (validated.type) filters.event_type = validated.type;
    if (validated.severity) filters.severity = validated.severity;
    if (validated.since) filters.created_at_gte = validated.since;
    if (validated.until) filters.created_at_lt = validated.until;
    if (validated.objectKind) filters.object_kind = validated.objectKind;
    if (validated.objectNamespace) filters.object_namespace = validated.objectNamespace;
    if (validated.objectName) filters.object_name = validated.objectName;
    
    // Query events
    const repository = new EventRepository();
    const events = repository.queryEvents({
      filters,
      limit: validated.limit,
      offset: validated.offset,
    });
    
    // Get total count
    const total = repository.countEvents(filters);
    
    // Build response
    const response = {
      events,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        returned: events.length,
      },
    };
    
    // Format and output
    const output = formatOutput(response, validated.format);
    console.log(output);
    
    process.exit(0);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify({
        error: 'Invalid arguments',
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      }));
    } else {
      console.error(JSON.stringify({
        error: 'Failed to query events',
        details: error.message,
      }));
    }
    process.exit(1);
  }
}

export async function getEvent(eventId: string, options: { format: string }) {
  try {
    const repository = new EventRepository();
    const event = repository.getEventById(eventId);
    
    if (!event) {
      console.error(JSON.stringify({
        error: 'Event not found',
        event_id: eventId,
      }));
      process.exit(1);
    }
    
    const output = formatOutput(event, options.format);
    console.log(output);
    
    process.exit(0);
  } catch (error: any) {
    console.error(JSON.stringify({
      error: 'Failed to get event',
      details: error.message,
    }));
    process.exit(1);
  }
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 008 (EventRepository query methods)
- Story 011 (Output formatters)

