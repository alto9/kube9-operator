import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { EventRepository } from './event-repository.js';
import { DatabaseManager } from './manager.js';
import { SchemaManager } from './schema.js';
import { generateEventId } from './event-id.js';
import type { Event } from '../types/event.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-event-repo-temp');

describe('EventRepository', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
    process.env.DB_PATH = testDbDir;
  });

  afterAll(() => {
    DatabaseManager.reset();
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    delete process.env.DB_PATH;
  });

  beforeEach(() => {
    DatabaseManager.reset();
    const schema = new SchemaManager();
    schema.initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  it('inserts valid event', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event: Event = {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'info',
    title: 'Test Event',
    description: 'A test event description',
    object_kind: 'Pod',
    object_namespace: 'default',
    object_name: 'test-pod',
    metadata: { test: 'value' },
    created_at: new Date().toISOString()
  };
  
  const result = repo.insertEvent(event);
  expect(result).toBeTruthy();
  
  DatabaseManager.reset();
});

  it('inserts event without optional fields', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event: Event = {
    id: generateEventId(),
    event_type: 'operator',
    severity: 'warning',
    title: 'Minimal Event',
    created_at: new Date().toISOString()
  };
  
  const result = repo.insertEvent(event);
  expect(result).toBeTruthy();
  
  DatabaseManager.reset();
});

  it('handles duplicate ID', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event: Event = {
    id: 'duplicate-test-id',
    event_type: 'system',
    severity: 'error',
    title: 'Duplicate Test',
    created_at: new Date().toISOString()
  };
  
  const result1 = repo.insertEvent(event);
  expect(result1).toBeTruthy();
  
  const result2 = repo.insertEvent(event);
  expect(result2).toBe(false);
  
  DatabaseManager.reset();
});

  it('validates event type', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event = {
    id: generateEventId(),
    event_type: 'invalid_type',
    severity: 'info',
    title: 'Test',
    created_at: new Date().toISOString()
  } as any;
  
  const result = repo.insertEvent(event);
  expect(result).toBe(false);
  
  DatabaseManager.reset();
});

  it('validates severity level', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event = {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'invalid_severity',
    title: 'Test',
    created_at: new Date().toISOString()
  } as any;
  
  const result = repo.insertEvent(event);
  expect(result).toBe(false);
  
  DatabaseManager.reset();
});

  it('validates title length', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event: Event = {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'info',
    title: 'x'.repeat(201), // Too long
    created_at: new Date().toISOString()
  };
  
  const result = repo.insertEvent(event);
  expect(result).toBe(false);
  
  DatabaseManager.reset();
});

  it('validates description length', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event: Event = {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'info',
    title: 'Test',
    description: 'x'.repeat(1001), // Too long
    created_at: new Date().toISOString()
  };
  
  const result = repo.insertEvent(event);
  expect(result).toBe(false);
  
  DatabaseManager.reset();
});

  it('serializes metadata to JSON', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  const manager = DatabaseManager.getInstance();
  const db = manager.getDatabase();
  
  const event: Event = {
    id: 'metadata-test',
    event_type: 'insight',
    severity: 'critical',
    title: 'Metadata Test',
    metadata: {
      nested: {
        key: 'value'
      },
      array: [1, 2, 3]
    },
    created_at: new Date().toISOString()
  };
  
  repo.insertEvent(event);
  
  const row = db.prepare('SELECT metadata FROM events WHERE id = ?').get('metadata-test') as { metadata: string };
  
  expect(row).toBeTruthy();
  expect(typeof row.metadata === 'string').toBeTruthy();
  
  const parsed = JSON.parse(row.metadata);
  expect(parsed).toEqual(event.metadata);
  
  DatabaseManager.reset();
});

  it('handles all event types', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const eventTypes = ['cluster', 'operator', 'insight', 'assessment', 'health', 'system'] as const;
  
  for (const eventType of eventTypes) {
    const event: Event = {
      id: `type-test-${eventType}`,
      event_type: eventType,
      severity: 'info',
      title: `Test ${eventType}`,
      created_at: new Date().toISOString()
    };
    
    const result = repo.insertEvent(event);
    expect(result, `Should insert event type: ${eventType}`);
  }
  
  DatabaseManager.reset();
});

  it('handles all severity levels', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const severities = ['info', 'warning', 'error', 'critical'] as const;
  
  for (const severity of severities) {
    const event: Event = {
      id: `severity-test-${severity}`,
      event_type: 'cluster',
      severity: severity,
      title: `Test ${severity}`,
      created_at: new Date().toISOString()
    };
    
    const result = repo.insertEvent(event);
    expect(result, `Should insert severity: ${severity}`);
  }
  
  DatabaseManager.reset();
});

  it('requires created_at timestamp', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event = {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'info',
    title: 'Test',
    // Missing created_at
  } as any;
  
  const result = repo.insertEvent(event);
  expect(result).toBe(false);
  
  DatabaseManager.reset();
});

  it('validates datetime format', () => {
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
  
  const repo = new EventRepository();
  
  const event = {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'info',
    title: 'Test',
    created_at: 'not-a-datetime'
  } as any;
  
  const result = repo.insertEvent(event);
  expect(result).toBe(false);
  
    DatabaseManager.reset();
  });
});
