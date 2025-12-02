import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { EventRepository } from './event-repository.js';
import { DatabaseManager } from './manager.js';
import { SchemaManager } from './schema.js';
import { generateEventId } from './event-id.js';
import type { Event } from '../types/event.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-event-queries-temp');

// Helper to create test event
function createTestEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: generateEventId(),
    event_type: 'cluster',
    severity: 'info',
    title: 'Test Event',
    created_at: new Date().toISOString(),
    ...overrides
  };
}

// Helper to setup fresh database for each test
function setupFreshDatabase() {
  if (existsSync(testDbDir)) {
    rmSync(testDbDir, { recursive: true, force: true });
  }
  mkdirSync(testDbDir, { recursive: true });
  process.env.DB_PATH = testDbDir;
  
  DatabaseManager.reset();
  const schema = new SchemaManager();
  schema.initialize();
}

describe('EventRepository Queries', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
    process.env.DB_PATH = testDbDir;
  });

  afterAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    delete process.env.DB_PATH;
  });

it('getEventById - retrieves existing event', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  const event = createTestEvent({ id: 'get-by-id-test' });
  
  repo.insertEvent(event);
  const retrieved = repo.getEventById('get-by-id-test');
  
  expect(retrieved).toBeTruthy();
  expect(retrieved?.id).toBe('get-by-id-test');
  expect(retrieved?.title).toBe(event.title);
  
  DatabaseManager.reset();
});

it('getEventById - returns null for non-existent event', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  const retrieved = repo.getEventById('non-existent');
  
  expect(retrieved).toBe(null);
  
  DatabaseManager.reset();
});

it('getEventById - deserializes metadata', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  const event = createTestEvent({
    id: 'metadata-test',
    metadata: { key: 'value', nested: { data: 123 } }
  });
  
  repo.insertEvent(event);
  const retrieved = repo.getEventById('metadata-test');
  
  expect(retrieved).toBeTruthy();
  expect(retrieved?.metadata).toEqual(event.metadata);
  
  DatabaseManager.reset();
});

it('queryEvents - returns all events with no filters', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Insert multiple events
  repo.insertEvent(createTestEvent({ id: 'evt1' }));
  repo.insertEvent(createTestEvent({ id: 'evt2' }));
  repo.insertEvent(createTestEvent({ id: 'evt3' }));
  
  const results = repo.queryEvents();
  
  expect(results.length).toBe(3);
  
  DatabaseManager.reset();
});

it('queryEvents - filters by event_type', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  repo.insertEvent(createTestEvent({ id: 'e1', event_type: 'cluster' }));
  repo.insertEvent(createTestEvent({ id: 'e2', event_type: 'operator' }));
  repo.insertEvent(createTestEvent({ id: 'e3', event_type: 'cluster' }));
  
  const results = repo.queryEvents({ filters: { event_type: 'cluster' } });
  
  expect(results.length).toBe(2);
  expect(results.every(e => e.event_type === 'cluster'));
  
  DatabaseManager.reset();
});

it('queryEvents - filters by severity', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  repo.insertEvent(createTestEvent({ id: 'e1', severity: 'info' }));
  repo.insertEvent(createTestEvent({ id: 'e2', severity: 'error' }));
  repo.insertEvent(createTestEvent({ id: 'e3', severity: 'error' }));
  
  const results = repo.queryEvents({ filters: { severity: 'error' } });
  
  expect(results.length).toBe(2);
  expect(results.every(e => e.severity === 'error'));
  
  DatabaseManager.reset();
});

it('queryEvents - filters by date range', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  repo.insertEvent(createTestEvent({ id: 'e1', created_at: yesterday.toISOString() }));
  repo.insertEvent(createTestEvent({ id: 'e2', created_at: now.toISOString() }));
  repo.insertEvent(createTestEvent({ id: 'e3', created_at: tomorrow.toISOString() }));
  
  const results = repo.queryEvents({
    filters: {
      created_at_gte: now.toISOString(),
      created_at_lt: new Date(tomorrow.getTime() + 1000).toISOString()
    }
  });
  
  expect(results.length).toBe(2);
  
  DatabaseManager.reset();
});

it('queryEvents - filters by object properties', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  repo.insertEvent(createTestEvent({ id: 'e1', object_kind: 'Pod', object_namespace: 'default', object_name: 'pod1' }));
  repo.insertEvent(createTestEvent({ id: 'e2', object_kind: 'Pod', object_namespace: 'kube-system', object_name: 'pod2' }));
  repo.insertEvent(createTestEvent({ id: 'e3', object_kind: 'Deployment', object_namespace: 'default', object_name: 'deploy1' }));
  
  const results = repo.queryEvents({
    filters: {
      object_kind: 'Pod',
      object_namespace: 'default'
    }
  });
  
  expect(results.length).toBe(1);
  expect(results[0].object_name).toBe('pod1');
  
  DatabaseManager.reset();
});

it('queryEvents - supports pagination with limit', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Insert 10 events
  for (let i = 0; i < 10; i++) {
    repo.insertEvent(createTestEvent({ id: `evt-${i}` }));
  }
  
  const results = repo.queryEvents({ limit: 5 });
  
  expect(results.length).toBe(5);
  
  DatabaseManager.reset();
});

it('queryEvents - supports pagination with offset', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Insert events with known created_at
  for (let i = 0; i < 10; i++) {
    const date = new Date('2025-01-01T00:00:00.000Z');
    date.setMinutes(i);
    repo.insertEvent(createTestEvent({ id: `evt-${i}`, created_at: date.toISOString() }));
  }
  
  const page1 = repo.queryEvents({ limit: 5, offset: 0 });
  const page2 = repo.queryEvents({ limit: 5, offset: 5 });
  
  expect(page1.length).toBe(5);
  expect(page2.length).toBe(5);
  expect(page1[0].id).not.toBe(page2[0].id);
  
  DatabaseManager.reset();
});

it('queryEvents - orders by created_at DESC', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  const date1 = new Date('2025-01-01T10:00:00.000Z');
  const date2 = new Date('2025-01-01T11:00:00.000Z');
  const date3 = new Date('2025-01-01T12:00:00.000Z');
  
  repo.insertEvent(createTestEvent({ id: 'e2', created_at: date2.toISOString() }));
  repo.insertEvent(createTestEvent({ id: 'e1', created_at: date1.toISOString() }));
  repo.insertEvent(createTestEvent({ id: 'e3', created_at: date3.toISOString() }));
  
  const results = repo.queryEvents();
  
  expect(results[0].id).toBe('e3');
  expect(results[1].id).toBe('e2');
  expect(results[2].id).toBe('e1');
  
  DatabaseManager.reset();
});

it('queryEvents - returns empty array when no results', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  const results = repo.queryEvents({ filters: { event_type: 'nonexistent' } });
  
  expect(Array.isArray(results)).toBeTruthy();
  expect(results.length).toBe(0);
  
  DatabaseManager.reset();
});

it('countEvents - counts all events with no filters', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  repo.insertEvent(createTestEvent());
  repo.insertEvent(createTestEvent());
  repo.insertEvent(createTestEvent());
  
  const count = repo.countEvents();
  
  expect(count).toBe(3);
  
  DatabaseManager.reset();
});

it('countEvents - counts filtered events', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  repo.insertEvent(createTestEvent({ event_type: 'cluster' }));
  repo.insertEvent(createTestEvent({ event_type: 'operator' }));
  repo.insertEvent(createTestEvent({ event_type: 'cluster' }));
  
  const count = repo.countEvents({ event_type: 'cluster' });
  
  expect(count).toBe(2);
  
  DatabaseManager.reset();
});

it('countEvents - returns 0 when no matches', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  const count = repo.countEvents({ event_type: 'nonexistent' });
  
  expect(count).toBe(0);
  
    DatabaseManager.reset();
  });
});
