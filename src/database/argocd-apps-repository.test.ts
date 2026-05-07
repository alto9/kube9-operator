import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { ArgoCDAppsRepository } from './argocd-apps-repository.js';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';

const testDbDir = path.join(process.cwd(), 'test-argocd-apps-temp');

describe('ArgoCDAppsRepository', () => {
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
    const dbFile = path.join(testDbDir, 'kube9.db');
    if (existsSync(dbFile)) {
      unlinkSync(dbFile);
    }
    new SchemaManager().initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  function insertRow(
    db: Database.Database,
    params: {
      cluster_id: string;
      app_namespace: string;
      app_name: string;
      collected_at: string;
      status_json: string;
      drift_json?: string | null;
    }
  ) {
    db.prepare(
      `INSERT INTO argocd_apps (cluster_id, app_namespace, app_name, collected_at, status_json, drift_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      params.cluster_id,
      params.app_namespace,
      params.app_name,
      params.collected_at,
      params.status_json,
      params.drift_json ?? null
    );
  }

  it('lists and counts with filters', () => {
    const db = DatabaseManager.getInstance().getDatabase();
    const status = {
      status: {
        sync: { status: 'Synced' },
        health: { status: 'Healthy' },
      },
    };
    insertRow(db, {
      cluster_id: 'cls_a',
      app_namespace: 'argocd',
      app_name: 'guestbook',
      collected_at: '2026-01-02T00:00:00.000Z',
      status_json: JSON.stringify(status),
    });
    insertRow(db, {
      cluster_id: 'cls_a',
      app_namespace: 'apps',
      app_name: 'other',
      collected_at: '2026-01-03T00:00:00.000Z',
      status_json: JSON.stringify({
        status: { sync: { status: 'OutOfSync' }, health: { status: 'Degraded' } },
      }),
    });

    const repo = new ArgoCDAppsRepository();
    const list = repo.listApplications({ filters: { cluster_id: 'cls_a' }, limit: 10, offset: 0 });
    expect(list.length).toBe(2);
    expect(list[0]?.app_name).toBe('other');
    expect(repo.countApplications({ cluster_id: 'cls_a' })).toBe(2);
    expect(repo.countApplications({ app_namespace: 'argocd' })).toBe(1);
  });

  it('getApplicationSnapshot returns parsed status and drift', () => {
    const db = DatabaseManager.getInstance().getDatabase();
    insertRow(db, {
      cluster_id: 'cls_1',
      app_namespace: 'ns',
      app_name: 'app',
      collected_at: '2026-01-01T00:00:00.000Z',
      status_json: JSON.stringify({ foo: 'bar' }),
      drift_json: JSON.stringify({ drift: true }),
    });
    const repo = new ArgoCDAppsRepository();
    const snap = repo.getApplicationSnapshot('cls_1', 'ns', 'app');
    expect(snap?.status).toEqual({ foo: 'bar' });
    expect(snap?.drift).toEqual({ drift: true });
    expect(repo.getApplicationSnapshot('cls_x', 'ns', 'app')).toBeNull();
  });

  it('getApplicationsStatusSummary aggregates sync and health', () => {
    const db = DatabaseManager.getInstance().getDatabase();
    const s = (sync: string, health: string) =>
      JSON.stringify({ status: { sync: { status: sync }, health: { status: health } } });
    insertRow(db, {
      cluster_id: 'c',
      app_namespace: 'n1',
      app_name: 'a',
      collected_at: '2026-01-01T00:00:00.000Z',
      status_json: s('Synced', 'Healthy'),
    });
    insertRow(db, {
      cluster_id: 'c',
      app_namespace: 'n2',
      app_name: 'b',
      collected_at: '2026-01-02T00:00:00.000Z',
      status_json: s('Synced', 'Healthy'),
    });
    insertRow(db, {
      cluster_id: 'c',
      app_namespace: 'n3',
      app_name: 'c',
      collected_at: '2026-01-03T00:00:00.000Z',
      status_json: s('OutOfSync', 'Degraded'),
    });

    const repo = new ArgoCDAppsRepository();
    const summary = repo.getApplicationsStatusSummary();
    expect(summary.storedCount).toBe(3);
    expect(summary.lastCollectedAt).toBe('2026-01-03T00:00:00.000Z');
    expect(summary.syncStatusCounts['Synced']).toBe(2);
    expect(summary.syncStatusCounts['OutOfSync']).toBe(1);
    expect(summary.healthStatusCounts['Healthy']).toBe(2);
    expect(summary.healthStatusCounts['Degraded']).toBe(1);
  });
});
