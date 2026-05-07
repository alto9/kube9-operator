/**
 * SQLite read path for persisted Argo CD Application rows (argocd_apps).
 */

import Database from 'better-sqlite3';
import { DatabaseManager } from './manager.js';
import { logger } from '../logging/logger.js';
import type { ArgoCDApplicationsPersistedSummary } from '../status/types.js';

export interface ArgoCDAppFilters {
  cluster_id?: string;
  app_namespace?: string;
  app_name?: string;
  collected_at_gte?: string;
  collected_at_lt?: string;
}

export interface ArgoCDAppQueryOptions {
  filters?: ArgoCDAppFilters;
  limit?: number;
  offset?: number;
}

export interface ArgoCDAppListRow {
  cluster_id: string;
  app_namespace: string;
  app_name: string;
  collected_at: string;
  sync_status: string;
  health_status: string;
}

export interface ArgoCDAppSnapshot {
  cluster_id: string;
  app_namespace: string;
  app_name: string;
  collected_at: string;
  status: unknown;
  drift: unknown | null;
}

const EMPTY_SUMMARY: ArgoCDApplicationsPersistedSummary = {
  storedCount: 0,
  lastCollectedAt: null,
  syncStatusCounts: {},
  healthStatusCounts: {},
};

function extractSyncHealthFromStatusJson(
  statusJson: string
): { sync: string; health: string } {
  try {
    const o = JSON.parse(statusJson) as {
      status?: { sync?: { status?: string }; health?: { status?: string } };
    };
    return {
      sync: typeof o.status?.sync?.status === 'string' ? o.status.sync.status : 'Unknown',
      health: typeof o.status?.health?.status === 'string' ? o.status.health.status : 'Unknown',
    };
  } catch {
    return { sync: 'Unknown', health: 'Unknown' };
  }
}

export class ArgoCDAppsRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  private tableReady(): boolean {
    const row = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='argocd_apps'`)
      .get() as { name: string } | undefined;
    return row !== undefined;
  }

  public listApplications(options: ArgoCDAppQueryOptions = {}): ArgoCDAppListRow[] {
    const { filters = {}, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.cluster_id) {
      conditions.push('cluster_id = ?');
      params.push(filters.cluster_id);
    }
    if (filters.app_namespace) {
      conditions.push('app_namespace = ?');
      params.push(filters.app_namespace);
    }
    if (filters.app_name) {
      conditions.push('app_name = ?');
      params.push(filters.app_name);
    }
    if (filters.collected_at_gte) {
      conditions.push('collected_at >= ?');
      params.push(filters.collected_at_gte);
    }
    if (filters.collected_at_lt) {
      conditions.push('collected_at < ?');
      params.push(filters.collected_at_lt);
    }

    let query = `
      SELECT cluster_id, app_namespace, app_name, collected_at, status_json
      FROM argocd_apps
    `;
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY collected_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as Array<{
      cluster_id: string;
      app_namespace: string;
      app_name: string;
      collected_at: string;
      status_json: string;
    }>;

    return rows.map((r) => {
      const { sync, health } = extractSyncHealthFromStatusJson(r.status_json);
      return {
        cluster_id: r.cluster_id,
        app_namespace: r.app_namespace,
        app_name: r.app_name,
        collected_at: r.collected_at,
        sync_status: sync,
        health_status: health,
      };
    });
  }

  public countApplications(filters: ArgoCDAppFilters = {}): number {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.cluster_id) {
      conditions.push('cluster_id = ?');
      params.push(filters.cluster_id);
    }
    if (filters.app_namespace) {
      conditions.push('app_namespace = ?');
      params.push(filters.app_namespace);
    }
    if (filters.app_name) {
      conditions.push('app_name = ?');
      params.push(filters.app_name);
    }
    if (filters.collected_at_gte) {
      conditions.push('collected_at >= ?');
      params.push(filters.collected_at_gte);
    }
    if (filters.collected_at_lt) {
      conditions.push('collected_at < ?');
      params.push(filters.collected_at_lt);
    }

    let q = 'SELECT COUNT(*) as count FROM argocd_apps';
    if (conditions.length > 0) {
      q += ' WHERE ' + conditions.join(' AND ');
    }
    const row = this.db.prepare(q).get(...params) as { count: number };
    return row.count;
  }

  public getApplicationSnapshot(
    clusterId: string,
    appNamespace: string,
    appName: string
  ): ArgoCDAppSnapshot | null {
    const row = this.db
      .prepare(
        `SELECT cluster_id, app_namespace, app_name, collected_at, status_json, drift_json           
         FROM argocd_apps
         WHERE cluster_id = ? AND app_namespace = ? AND app_name = ?`
      )
      .get(clusterId, appNamespace, appName) as
      | {
          cluster_id: string;
          app_namespace: string;
          app_name: string;
          collected_at: string;
          status_json: string;
          drift_json: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    try {
      const status = JSON.parse(row.status_json) as unknown;
      const drift =
        row.drift_json === null || row.drift_json === undefined || row.drift_json === ''
          ? null
          : (JSON.parse(row.drift_json) as unknown);
      return {
        cluster_id: row.cluster_id,
        app_namespace: row.app_namespace,
        app_name: row.app_name,
        collected_at: row.collected_at,
        status,
        drift,
      };
    } catch (e) {
      logger.warn('Stored argocd_apps row failed JSON parse', {
        clusterId,
        appNamespace,
        appName,
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  /**
   * Bounded aggregate for operator status ConfigMap (counts only; no raw Application payloads).
   */
  public getApplicationsStatusSummary(): ArgoCDApplicationsPersistedSummary {
    if (!this.tableReady()) {
      return { ...EMPTY_SUMMARY };
    }

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as c, MAX(collected_at) as last FROM argocd_apps`)
      .get() as { c: number; last: string | null };

    if (countRow.c === 0) {
      return { ...EMPTY_SUMMARY };
    }

    const syncStatusCounts: Record<string, number> = {};
    const healthStatusCounts: Record<string, number> = {};

    try {
      const syncRows = this.db.prepare(`
        SELECT COALESCE(json_extract(status_json, '$.status.sync.status'), 'Unknown') as k, COUNT(*) as c
        FROM argocd_apps
        GROUP BY k
      `).all() as Array<{ k: string; c: number }>;
      for (const r of syncRows) {
        syncStatusCounts[r.k] = r.c;
      }
      const healthRows = this.db.prepare(`
        SELECT COALESCE(json_extract(status_json, '$.status.health.status'), 'Unknown') as k, COUNT(*) as c
        FROM argocd_apps
        GROUP BY k
      `).all() as Array<{ k: string; c: number }>;
      for (const r of healthRows) {
        healthStatusCounts[r.k] = r.c;
      }
    } catch {
      const rows = this.db.prepare(`SELECT status_json FROM argocd_apps`).all() as Array<{
        status_json: string;
      }>;
      for (const r of rows) {
        const { sync, health } = extractSyncHealthFromStatusJson(r.status_json);
        syncStatusCounts[sync] = (syncStatusCounts[sync] ?? 0) + 1;
        healthStatusCounts[health] = (healthStatusCounts[health] ?? 0) + 1;
      }
    }

    return {
      storedCount: countRow.c,
      lastCollectedAt: countRow.last,
      syncStatusCounts,
      healthStatusCounts,
    };
  }
}
