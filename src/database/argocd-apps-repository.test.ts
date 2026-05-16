import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { ArgoCDAppsRepository } from './argocd-apps-repository.js';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';

const testDbDir = path.join(process.cwd(), 'test-argocd-apps-repo-temp');

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
    const dbBase = path.join(testDbDir, 'kube9.db');
    for (const file of [dbBase, `${dbBase}-wal`, `${dbBase}-shm`]) {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    }
    const schema = new SchemaManager();
    schema.initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  function insertRowForQueryTests(
    db: Database.Database,
    params: {
      cluster_id: string;
      app_namespace: string;
      app_name: string;
      observed_at: string;
      status_json: string;
      drift_json?: string | null;
    }
  ) {
    db.prepare(
      `INSERT INTO argocd_apps (cluster_id, app_namespace, app_name, observed_at, status_json, drift_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      params.cluster_id,
      params.app_namespace,
      params.app_name,
      params.observed_at,
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
    insertRowForQueryTests(db, {
      cluster_id: 'cls_a',
      app_namespace: 'argocd',
      app_name: 'guestbook',
      observed_at: '2026-01-02T00:00:00.000Z',
      status_json: JSON.stringify(status),
    });
    insertRowForQueryTests(db, {
      cluster_id: 'cls_a',
      app_namespace: 'apps',
      app_name: 'other',
      observed_at: '2026-01-03T00:00:00.000Z',
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
    insertRowForQueryTests(db, {
      cluster_id: 'cls_1',
      app_namespace: 'ns',
      app_name: 'app',
      observed_at: '2026-01-01T00:00:00.000Z',
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
    insertRowForQueryTests(db, {
      cluster_id: 'c',
      app_namespace: 'n1',
      app_name: 'a',
      observed_at: '2026-01-01T00:00:00.000Z',
      status_json: s('Synced', 'Healthy'),
    });
    insertRowForQueryTests(db, {
      cluster_id: 'c',
      app_namespace: 'n2',
      app_name: 'b',
      observed_at: '2026-01-02T00:00:00.000Z',
      status_json: s('Synced', 'Healthy'),
    });
    insertRowForQueryTests(db, {
      cluster_id: 'c',
      app_namespace: 'n3',
      app_name: 'c',
      observed_at: '2026-01-03T00:00:00.000Z',
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

  it('upserts and reads by key', () => {
    const repo = new ArgoCDAppsRepository();
    const ts = new Date().toISOString();
    const ok = repo.upsertSnapshot({
      cluster_id: 'cls_a',
      app_namespace: 'argocd',
      app_name: 'guestbook',
      observed_at: ts,
      status_json: { sync: 'Synced', health: 'Healthy', revision: 'abc' },
    });
    expect(ok).toBe(true);

    const row = repo.getByKey('cls_a', 'argocd', 'guestbook');
    expect(row).not.toBeNull();
    expect(row?.status_json).toBe(JSON.stringify({ sync: 'Synced', health: 'Healthy', revision: 'abc' }));
    expect(row?.drift_json).toBeNull();
  });

  it('replaces row on conflict', () => {
    const repo = new ArgoCDAppsRepository();
    const t1 = new Date('2024-01-01T00:00:00.000Z').toISOString();
    const t2 = new Date('2024-02-01T00:00:00.000Z').toISOString();

    repo.upsertSnapshot({
      cluster_id: 'cls_a',
      app_namespace: 'ns',
      app_name: 'app',
      observed_at: t1,
      status_json: { v: 1 },
    });
    repo.upsertSnapshot({
      cluster_id: 'cls_a',
      app_namespace: 'ns',
      app_name: 'app',
      observed_at: t2,
      status_json: { v: 2 },
    });

    const row = repo.getByKey('cls_a', 'ns', 'app');
    expect(row?.observed_at).toBe(t2);
    expect(JSON.parse(row!.status_json)).toEqual({ v: 2 });
  });

  it('persists drift_json when provided', () => {
    const repo = new ArgoCDAppsRepository();
    repo.upsertSnapshot({
      cluster_id: 'cls_a',
      app_namespace: 'ns',
      app_name: 'x',
      observed_at: new Date().toISOString(),
      status_json: { ok: true },
      drift_json: { level: 'none' },
    });
    const row = repo.getByKey('cls_a', 'ns', 'x');
    expect(JSON.parse(row!.drift_json!)).toEqual({ level: 'none' });
  });

  it('lists by cluster ordered by observed_at descending', () => {
    const repo = new ArgoCDAppsRepository();
    const cluster = 'cls_sort';

    repo.upsertSnapshot({
      cluster_id: cluster,
      app_namespace: 'a',
      app_name: 'old',
      observed_at: '2024-01-01T00:00:00.000Z',
      status_json: { n: 1 },
    });
    repo.upsertSnapshot({
      cluster_id: cluster,
      app_namespace: 'b',
      app_name: 'new',
      observed_at: '2024-06-01T00:00:00.000Z',
      status_json: { n: 2 },
    });

    const rows = repo.listByCluster(cluster);
    expect(rows.map((r) => r.app_name)).toEqual(['new', 'old']);
  });

  it('rejects invalid inputs', () => {
    const repo = new ArgoCDAppsRepository();
    expect(
      repo.upsertSnapshot({
        cluster_id: '',
        app_namespace: 'ns',
        app_name: 'a',
        observed_at: new Date().toISOString(),
        status_json: {},
      })
    ).toBe(false);

    expect(
      repo.upsertSnapshot({
        cluster_id: 'c',
        app_namespace: 'ns',
        app_name: 'a',
        observed_at: new Date().toISOString(),
        status_json: [] as unknown as Record<string, unknown>,
      })
    ).toBe(false);
  });

  it('initialize twice does not duplicate data paths', () => {
    const repo = new ArgoCDAppsRepository();
    repo.upsertSnapshot({
      cluster_id: 'cls_idem',
      app_namespace: 'n',
      app_name: 'y',
      observed_at: new Date().toISOString(),
      status_json: { x: 1 },
    });

    const schema = new SchemaManager();
    schema.initialize();

    expect(repo.getByKey('cls_idem', 'n', 'y')).not.toBeNull();
  });
});
