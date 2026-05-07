import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { ArgoCDAppsRepository } from './argocd-apps-repository.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

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
    const schema = new SchemaManager();
    schema.initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
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
