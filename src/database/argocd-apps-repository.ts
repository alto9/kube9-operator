/**
 * SQLite persistence for Argo CD Application snapshots (M9).
 */

import Database from 'better-sqlite3';
import { DatabaseManager } from './manager.js';
import { logger } from '../logging/logger.js';
import { ArgoCdAppUpsertSchema, type ArgoCdAppUpsert } from './argocd-apps-contracts.js';
import { ZodError } from 'zod';

export interface ArgoCdAppRow {
  cluster_id: string;
  app_namespace: string;
  app_name: string;
  observed_at: string;
  status_json: string;
  drift_json: string | null;
}

export class ArgoCDAppsRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  /**
   * Insert or replace the snapshot for (cluster_id, app_namespace, app_name).
   */
  public upsertSnapshot(input: unknown): boolean {
    try {
      const v = ArgoCdAppUpsertSchema.parse(input) as ArgoCdAppUpsert;
      const statusStr = JSON.stringify(v.status_json);
      const driftStr =
        v.drift_json === null || v.drift_json === undefined ? null : JSON.stringify(v.drift_json);

      const stmt = this.db.prepare(`
        INSERT INTO argocd_apps (
          cluster_id, app_namespace, app_name, observed_at, status_json, drift_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(cluster_id, app_namespace, app_name) DO UPDATE SET
          observed_at = excluded.observed_at,
          status_json = excluded.status_json,
          drift_json = excluded.drift_json
      `);

      stmt.run(
        v.cluster_id,
        v.app_namespace,
        v.app_name,
        v.observed_at,
        statusStr,
        driftStr
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        logger.warn('Argo CD app snapshot validation failed', { issues: error.issues });
        return false;
      }
      logger.error('Failed to upsert argocd_apps row', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public getByKey(
    clusterId: string,
    appNamespace: string,
    appName: string
  ): ArgoCdAppRow | null {
    const row = this.db
      .prepare(
        `SELECT cluster_id, app_namespace, app_name, observed_at, status_json, drift_json
         FROM argocd_apps
         WHERE cluster_id = ? AND app_namespace = ? AND app_name = ?`
      )
      .get(clusterId, appNamespace, appName) as ArgoCdAppRow | undefined;
    return row ?? null;
  }

  public listByCluster(clusterId: string, limit = 100): ArgoCdAppRow[] {
    const rows = this.db
      .prepare(
        `SELECT cluster_id, app_namespace, app_name, observed_at, status_json, drift_json
         FROM argocd_apps
         WHERE cluster_id = ?
         ORDER BY observed_at DESC
         LIMIT ?`
      )
      .all(clusterId, limit) as ArgoCdAppRow[];
    return rows;
  }
}
