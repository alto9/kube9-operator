import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { RetentionCleanup } from './retention-cleanup.js';
import { EventRepository } from './event-repository.js';
import { DatabaseManager } from './manager.js';
import { SchemaManager } from './schema.js';
import { generateEventId } from './event-id.js';
import type { Event } from '../types/event.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-retention-temp');

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

// Helper to setup fresh database
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

describe('RetentionCleanup', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
  });

it('RetentionCleanup - deletes info events older than retention period', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create old info event (10 days old)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 10);
  repo.insertEvent(createTestEvent({ 
    id: 'old-info', 
    severity: 'info', 
    created_at: oldDate.toISOString() 
  }));
  
  // Create recent info event (3 days old)
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 3);
  repo.insertEvent(createTestEvent({ 
    id: 'recent-info', 
    severity: 'info', 
    created_at: recentDate.toISOString() 
  }));
  
  // Run cleanup (7 day retention)
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(1);
  
  // Verify only recent event remains
  const events = repo.queryEvents();
  expect(events.length).toBe(1);
  expect(events[0].id).toBe('recent-info');
  
  DatabaseManager.reset();
});

it('RetentionCleanup - deletes warning events older than retention period', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create old warning event (10 days old)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 10);
  repo.insertEvent(createTestEvent({ 
    id: 'old-warning', 
    severity: 'warning', 
    created_at: oldDate.toISOString() 
  }));
  
  // Run cleanup
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(1);
  
  DatabaseManager.reset();
});

it('RetentionCleanup - deletes error events older than 30 days', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create old error event (35 days old)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 35);
  repo.insertEvent(createTestEvent({ 
    id: 'old-error', 
    severity: 'error', 
    created_at: oldDate.toISOString() 
  }));
  
  // Create recent error event (20 days old)
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 20);
  repo.insertEvent(createTestEvent({ 
    id: 'recent-error', 
    severity: 'error', 
    created_at: recentDate.toISOString() 
  }));
  
  // Run cleanup
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(1);
  
  // Verify only recent error remains
  const events = repo.queryEvents();
  expect(events.length).toBe(1);
  expect(events[0].id).toBe('recent-error');
  
  DatabaseManager.reset();
});

it('RetentionCleanup - deletes critical events older than 30 days', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create old critical event (35 days old)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 35);
  repo.insertEvent(createTestEvent({ 
    id: 'old-critical', 
    severity: 'critical', 
    created_at: oldDate.toISOString() 
  }));
  
  // Run cleanup
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(1);
  
  DatabaseManager.reset();
});

it('RetentionCleanup - applies different retention periods correctly', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create events at various ages
  const date10DaysAgo = new Date();
  date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);
  
  const date35DaysAgo = new Date();
  date35DaysAgo.setDate(date35DaysAgo.getDate() - 35);
  
  // Old info (should be deleted)
  repo.insertEvent(createTestEvent({ 
    id: 'old-info', 
    severity: 'info', 
    created_at: date10DaysAgo.toISOString() 
  }));
  
  // Old error at 10 days (should NOT be deleted - within 30 day retention)
  repo.insertEvent(createTestEvent({ 
    id: 'recent-error', 
    severity: 'error', 
    created_at: date10DaysAgo.toISOString() 
  }));
  
  // Very old error (should be deleted)
  repo.insertEvent(createTestEvent({ 
    id: 'old-error', 
    severity: 'error', 
    created_at: date35DaysAgo.toISOString() 
  }));
  
  // Run cleanup
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(2);
  
  // Verify only recent error remains
  const events = repo.queryEvents();
  expect(events.length).toBe(1);
  expect(events[0].id).toBe('recent-error');
  
  DatabaseManager.reset();
});

it('RetentionCleanup - respects custom retention periods', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create event 5 days old
  const date5DaysAgo = new Date();
  date5DaysAgo.setDate(date5DaysAgo.getDate() - 5);
  repo.insertEvent(createTestEvent({ 
    id: 'test-event', 
    severity: 'info', 
    created_at: date5DaysAgo.toISOString() 
  }));
  
  // Cleanup with 3 day retention should delete it
  const cleanup = new RetentionCleanup(3, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(1);
  
  DatabaseManager.reset();
});

it('RetentionCleanup - returns 0 when no events to delete', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create recent event
  repo.insertEvent(createTestEvent({ severity: 'info' }));
  
  // Run cleanup
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(0);
  
  // Verify event still exists
  const events = repo.queryEvents();
  expect(events.length).toBe(1);
  
  DatabaseManager.reset();
});

it('RetentionCleanup - handles empty database', () => {
  setupFreshDatabase();
  
  const cleanup = new RetentionCleanup(7, 30);
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(0);
  
  DatabaseManager.reset();
});

it('RetentionCleanup - start and stop methods work', () => {
  setupFreshDatabase();
  
  const cleanup = new RetentionCleanup(7, 30);
  
  // Should not throw
  cleanup.start();
  expect(true).toBeTruthy();
  
  cleanup.stop();
  expect(true).toBeTruthy();
  
  // Should be safe to call stop multiple times
  cleanup.stop();
  expect(true).toBeTruthy();
  
  DatabaseManager.reset();
});

it('RetentionCleanup - can be called manually', () => {
  setupFreshDatabase();
  
  const repo = new EventRepository();
  
  // Create old event
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 10);
  repo.insertEvent(createTestEvent({ 
    severity: 'info', 
    created_at: oldDate.toISOString() 
  }));
  
  const cleanup = new RetentionCleanup(7, 30);
  
  // Manual cleanup (without starting scheduler)
  const deleted = cleanup.runCleanup();
  
  expect(deleted).toBe(1);
  
  DatabaseManager.reset();
});
});
