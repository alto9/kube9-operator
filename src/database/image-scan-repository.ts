/**
 * Persistence for Trivy (or other) image scans and normalized vulnerability rows.
 */

import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';
import {
  ImageScanRecord,
  ImageScanRecordSchema,
  ImageVulnerabilityInput,
  ImageVulnerabilityInputSchema,
} from './image-scan-contracts.js';

export interface ImageScanRow {
  scan_id: string;
  image_reference: string;
  image_digest: string | null;
  started_at: string;
  completed_at: string | null;
  state: string;
  scanner: string;
  error_message: string | null;
}

export interface ImageVulnerabilityRow {
  id: string;
  scan_id: string;
  vulnerability_id: string;
  severity: string;
  package_name: string | null;
  installed_version: string | null;
  fixed_version: string | null;
  title: string | null;
  raw_metadata: string | null;
}

export interface ImageScanFilters {
  state?: string;
  image_reference?: string;
  /** Match image_reference with SQL LIKE '%' || value || '%' */
  image_reference_contains?: string;
  started_from?: string;
  started_to?: string;
  completed_from?: string;
  completed_to?: string;
}

export interface ImageScanQueryOptions {
  filters?: ImageScanFilters;
  limit?: number;
  offset?: number;
}

export interface ImageVulnerabilityFilters {
  scan_id?: string;
  severity?: string | string[];
  vulnerability_id?: string;
  image_reference?: string;
  /** Time range on parent scan completed_at (ISO 8601), inclusive */
  completed_from?: string;
  completed_to?: string;
}

export interface ImageVulnerabilityQueryOptions {
  filters?: ImageVulnerabilityFilters;
  limit?: number;
  offset?: number;
}

export class ImageScanRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  public upsertScan(record: ImageScanRecord): void {
    const v = ImageScanRecordSchema.parse(record);
    const stmt = this.db.prepare(`
      INSERT INTO image_scans (
        scan_id, image_reference, image_digest, started_at, completed_at,
        state, scanner, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scan_id) DO UPDATE SET
        image_reference = excluded.image_reference,
        image_digest = excluded.image_digest,
        started_at = excluded.started_at,
        completed_at = COALESCE(excluded.completed_at, completed_at),
        state = excluded.state,
        scanner = excluded.scanner,
        error_message = excluded.error_message
    `);
    stmt.run(
      v.scan_id,
      v.image_reference,
      v.image_digest ?? null,
      v.started_at,
      v.completed_at ?? null,
      v.state,
      v.scanner,
      v.error_message ?? null
    );
  }

  public getScanById(scanId: string): ImageScanRecord | null {
    const row = this.db
      .prepare('SELECT * FROM image_scans WHERE scan_id = ?')
      .get(scanId) as ImageScanRow | undefined;
    if (!row) return null;
    return this.rowToScanRecord(row);
  }

  public queryScans(options: ImageScanQueryOptions = {}): ImageScanRecord[] {
    const { filters = {}, limit = 100, offset = 0 } = options;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    if (filters.image_reference) {
      conditions.push('image_reference = ?');
      params.push(filters.image_reference);
    }
    if (filters.image_reference_contains) {
      conditions.push('image_reference LIKE ?');
      params.push(`%${filters.image_reference_contains}%`);
    }
    if (filters.started_from) {
      conditions.push('started_at >= ?');
      params.push(filters.started_from);
    }
    if (filters.started_to) {
      conditions.push('started_at <= ?');
      params.push(filters.started_to);
    }
    if (filters.completed_from) {
      conditions.push('completed_at IS NOT NULL AND completed_at >= ?');
      params.push(filters.completed_from);
    }
    if (filters.completed_to) {
      conditions.push('completed_at IS NOT NULL AND completed_at <= ?');
      params.push(filters.completed_to);
    }

    let query = 'SELECT * FROM image_scans';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as ImageScanRow[];
    return rows.map((r) => this.rowToScanRecord(r));
  }

  public countScans(filters: ImageScanFilters = {}): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    if (filters.image_reference) {
      conditions.push('image_reference = ?');
      params.push(filters.image_reference);
    }
    if (filters.image_reference_contains) {
      conditions.push('image_reference LIKE ?');
      params.push(`%${filters.image_reference_contains}%`);
    }
    if (filters.started_from) {
      conditions.push('started_at >= ?');
      params.push(filters.started_from);
    }
    if (filters.started_to) {
      conditions.push('started_at <= ?');
      params.push(filters.started_to);
    }
    if (filters.completed_from) {
      conditions.push('completed_at IS NOT NULL AND completed_at >= ?');
      params.push(filters.completed_from);
    }
    if (filters.completed_to) {
      conditions.push('completed_at IS NOT NULL AND completed_at <= ?');
      params.push(filters.completed_to);
    }

    let query = 'SELECT COUNT(*) as count FROM image_scans';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const result = this.db.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Replace all vulnerability rows for a scan (idempotent completion write).
   */
  public replaceVulnerabilitiesForScan(
    scanId: string,
    rows: ImageVulnerabilityInput[]
  ): void {
    const validated = rows.map((r) => ImageVulnerabilityInputSchema.parse(r));
    const del = this.db.prepare('DELETE FROM image_vulnerabilities WHERE scan_id = ?');
    const ins = this.db.prepare(`
      INSERT INTO image_vulnerabilities (
        id, scan_id, vulnerability_id, severity, package_name,
        installed_version, fixed_version, title, raw_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const run = this.db.transaction(() => {
      del.run(scanId);
      for (const row of validated) {
        ins.run(
          row.id,
          row.scan_id,
          row.vulnerability_id,
          row.severity,
          row.package_name ?? null,
          row.installed_version ?? null,
          row.fixed_version ?? null,
          row.title ?? null,
          row.raw_metadata ?? null
        );
      }
    });
    run();
  }

  public insertVulnerabilities(rows: ImageVulnerabilityInput[]): void {
    if (rows.length === 0) return;
    const validated = rows.map((r) => ImageVulnerabilityInputSchema.parse(r));
    const ins = this.db.prepare(`
      INSERT INTO image_vulnerabilities (
        id, scan_id, vulnerability_id, severity, package_name,
        installed_version, fixed_version, title, raw_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const run = this.db.transaction(() => {
      for (const row of validated) {
        ins.run(
          row.id,
          row.scan_id,
          row.vulnerability_id,
          row.severity,
          row.package_name ?? null,
          row.installed_version ?? null,
          row.fixed_version ?? null,
          row.title ?? null,
          row.raw_metadata ?? null
        );
      }
    });
    run();
  }

  public queryVulnerabilities(
    options: ImageVulnerabilityQueryOptions = {}
  ): ImageVulnerabilityRow[] {
    const { filters = {}, limit = 500, offset = 0 } = options;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.scan_id) {
      conditions.push('v.scan_id = ?');
      params.push(filters.scan_id);
    }
    if (filters.vulnerability_id) {
      conditions.push('v.vulnerability_id = ?');
      params.push(filters.vulnerability_id);
    }
    if (filters.image_reference) {
      conditions.push('s.image_reference = ?');
      params.push(filters.image_reference);
    }
    if (filters.severity) {
      const sev = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      conditions.push(`v.severity IN (${sev.map(() => '?').join(',')})`);
      params.push(...sev);
    }
    if (filters.completed_from) {
      conditions.push('s.completed_at IS NOT NULL AND s.completed_at >= ?');
      params.push(filters.completed_from);
    }
    if (filters.completed_to) {
      conditions.push('s.completed_at IS NOT NULL AND s.completed_at <= ?');
      params.push(filters.completed_to);
    }

    let query = `
      SELECT v.id, v.scan_id, v.vulnerability_id, v.severity, v.package_name,
             v.installed_version, v.fixed_version, v.title, v.raw_metadata
      FROM image_vulnerabilities v
      INNER JOIN image_scans s ON s.scan_id = v.scan_id
    `;
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY v.severity DESC, v.vulnerability_id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(query).all(...params) as ImageVulnerabilityRow[];
  }

  public countVulnerabilities(filters: ImageVulnerabilityFilters = {}): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters.scan_id) {
      conditions.push('v.scan_id = ?');
      params.push(filters.scan_id);
    }
    if (filters.vulnerability_id) {
      conditions.push('v.vulnerability_id = ?');
      params.push(filters.vulnerability_id);
    }
    if (filters.image_reference) {
      conditions.push('s.image_reference = ?');
      params.push(filters.image_reference);
    }
    if (filters.severity) {
      const sev = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      conditions.push(`v.severity IN (${sev.map(() => '?').join(',')})`);
      params.push(...sev);
    }
    if (filters.completed_from) {
      conditions.push('s.completed_at IS NOT NULL AND s.completed_at >= ?');
      params.push(filters.completed_from);
    }
    if (filters.completed_to) {
      conditions.push('s.completed_at IS NOT NULL AND s.completed_at <= ?');
      params.push(filters.completed_to);
    }

    let query = `
      SELECT COUNT(*) as count
      FROM image_vulnerabilities v
      INNER JOIN image_scans s ON s.scan_id = v.scan_id
    `;
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const result = this.db.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  public deleteScan(scanId: string): number {
    const r = this.db.prepare('DELETE FROM image_scans WHERE scan_id = ?').run(scanId);
    return r.changes;
  }

  /**
   * Retention helper: remove completed scans (and cascaded vulnerabilities) older than cutoff.
   */
  public deleteScansCompletedBefore(isoTimestamp: string): number {
    const r = this.db
      .prepare(
        `DELETE FROM image_scans WHERE completed_at IS NOT NULL AND completed_at < ?`
      )
      .run(isoTimestamp);
    return r.changes;
  }

  private rowToScanRecord(row: ImageScanRow): ImageScanRecord {
    return ImageScanRecordSchema.parse({
      scan_id: row.scan_id,
      image_reference: row.image_reference,
      image_digest: row.image_digest ?? undefined,
      started_at: row.started_at,
      completed_at: row.completed_at ?? undefined,
      state: row.state,
      scanner: row.scanner,
      error_message: row.error_message ?? undefined,
    });
  }
}
