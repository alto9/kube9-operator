/**
 * CLI Events Commands
 */

import { z } from 'zod';
import { EventRepository, type EventFilters } from '../../database/event-repository.js';
import { formatOutput } from '../formatters.js';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';

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
    // Initialize database
    DatabaseManager.getInstance();
    const schema = new SchemaManager();
    schema.initialize();
    
    // Validate options
    const validated = ListOptionsSchema.parse(options);
    
    // Build filters
    const filters: EventFilters = {
      event_type: validated.type,
      severity: validated.severity,
      created_at_gte: validated.since,
      created_at_lt: validated.until,
      object_kind: validated.objectKind,
      object_namespace: validated.objectNamespace,
      object_name: validated.objectName,
    };
    
    // Query events
    const repo = new EventRepository();
    const events = repo.queryEvents({
      filters,
      limit: validated.limit,
      offset: validated.offset,
    });
    
    const total = repo.countEvents(filters);
    
    const result = {
      events,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        returned: events.length,
      }
    };
    
    const output = formatOutput(result, validated.format);
    console.log(output);
    
    process.exit(0);
  } catch (error: any) {
    console.error(JSON.stringify({
      error: 'Failed to list events',
      details: error.message,
    }));
    process.exit(1);
  }
}

export async function getEvent(eventId: string, options: { format: string }) {
  try {
    // Initialize database
    DatabaseManager.getInstance();
    const schema = new SchemaManager();
    schema.initialize();
    
    // Validate format
    const format = z.enum(['json', 'yaml', 'table']).parse(options.format);
    
    // Get event
    const repo = new EventRepository();
    const event = repo.getEventById(eventId);
    
    if (!event) {
      console.error(JSON.stringify({
        error: 'Event not found',
        event_id: eventId,
      }));
      process.exit(1);
    }
    
    const output = formatOutput(event, format);
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

