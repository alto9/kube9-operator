/**
 * Event Types - Schema and type definitions for events
 */

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

