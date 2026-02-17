/**
 * Assessment Repository - Storage methods for assessment runs and check history
 */

import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';
import {
  AssessmentRunRecord,
  AssessmentRunRecordSchema,
  AssessmentCheckResult,
  AssessmentCheckResultSchema,
  AssessmentLifecycleStateSchema,
  AssessmentRunModeSchema,
} from '../assessment/contracts.js';

/** Row from assessments table */
export interface AssessmentRow {
  run_id: string;
  mode: string;
  state: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_checks: number;
  completed_checks: number;
  passed_checks: number;
  failed_checks: number;
  warning_checks: number;
  skipped_checks: number;
  error_checks: number;
  timeout_checks: number;
  failure_reason: string | null;
}

/** Row from assessment_history table */
export interface AssessmentHistoryRow {
  id: string;
  run_id: string;
  check_id: string;
  pillar: string;
  check_name: string | null;
  status: string;
  object_kind: string | null;
  object_namespace: string | null;
  object_name: string | null;
  message: string | null;
  remediation: string | null;
  assessed_at: string;
  duration_ms: number | null;
  error_code: string | null;
}

export interface AssessmentFilters {
  run_id?: string;
  state?: string;
  pillar?: string | string[];
  status?: string | string[];
  since?: string;
}

export interface AssessmentQueryOptions {
  filters?: AssessmentFilters;
  limit?: number;
  offset?: number;
}

/**
 * AssessmentRepository provides methods for persisting and querying assessment runs
 * and per-check history.
 */
export class AssessmentRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  /**
   * Insert or update an assessment run record
   */
  public upsertAssessment(record: AssessmentRunRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO assessments (
        run_id, mode, state, requested_at, started_at, completed_at,
        total_checks, completed_checks, passed_checks, failed_checks,
        warning_checks, skipped_checks, error_checks, timeout_checks,
        failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        state = excluded.state,
        started_at = COALESCE(excluded.started_at, started_at),
        completed_at = COALESCE(excluded.completed_at, completed_at),
        total_checks = excluded.total_checks,
        completed_checks = excluded.completed_checks,
        passed_checks = excluded.passed_checks,
        failed_checks = excluded.failed_checks,
        warning_checks = excluded.warning_checks,
        skipped_checks = excluded.skipped_checks,
        error_checks = excluded.error_checks,
        timeout_checks = excluded.timeout_checks,
        failure_reason = excluded.failure_reason
    `);

    const validated = AssessmentRunRecordSchema.parse(record);
    stmt.run(
      validated.run_id,
      validated.mode,
      validated.state,
      validated.requested_at,
      validated.started_at ?? null,
      validated.completed_at ?? null,
      validated.total_checks,
      validated.completed_checks,
      validated.passed_checks,
      validated.failed_checks,
      validated.warning_checks,
      validated.skipped_checks,
      validated.error_checks,
      validated.timeout_checks,
      validated.failure_reason ?? null
    );
  }

  /**
   * Insert a check result into assessment_history
   */
  public insertCheckResult(
    result: AssessmentCheckResult,
    id: string,
    checkName?: string
  ): void {
    const validated = AssessmentCheckResultSchema.parse(result);
    const stmt = this.db.prepare(`
      INSERT INTO assessment_history (
        id, run_id, check_id, pillar, check_name, status,
        object_kind, object_namespace, object_name,
        message, remediation, assessed_at, duration_ms, error_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      validated.run_id,
      validated.check_id,
      validated.pillar,
      checkName ?? null,
      validated.status,
      null,
      null,
      null,
      validated.message,
      validated.remediation ?? null,
      validated.assessed_at,
      validated.duration_ms ?? null,
      validated.error_code ?? null
    );
  }

  /**
   * Get an assessment run by ID
   */
  public getAssessmentById(runId: string): AssessmentRunRecord | null {
    const row = this.db
      .prepare('SELECT * FROM assessments WHERE run_id = ?')
      .get(runId) as AssessmentRow | undefined;

    if (!row) return null;
    return this.rowToRunRecord(row);
  }

  /**
   * Query assessment runs with filters and pagination
   */
  public queryAssessments(options: AssessmentQueryOptions = {}): AssessmentRunRecord[] {
    const { filters = {}, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    if (filters.since) {
      conditions.push('requested_at >= ?');
      params.push(filters.since);
    }

    let query = 'SELECT * FROM assessments';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY requested_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as AssessmentRow[];
    return rows.map((r) => this.rowToRunRecord(r));
  }

  /**
   * Query assessment history (per-check results) with filters and pagination
   */
  public queryHistory(options: AssessmentQueryOptions = {}): AssessmentHistoryRow[] {
    const { filters = {}, limit = 100, offset = 0 } = options;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.run_id) {
      conditions.push('run_id = ?');
      params.push(filters.run_id);
    }
    if (filters.pillar) {
      const pillars = Array.isArray(filters.pillar) ? filters.pillar : [filters.pillar];
      conditions.push(`pillar IN (${pillars.map(() => '?').join(',')})`);
      params.push(...pillars);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (filters.since) {
      conditions.push('assessed_at >= ?');
      params.push(filters.since);
    }

    let query = 'SELECT * FROM assessment_history';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY assessed_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(query).all(...params) as AssessmentHistoryRow[];
  }

  /**
   * Count assessment runs matching filters
   */
  public countAssessments(filters: AssessmentFilters = {}): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    if (filters.since) {
      conditions.push('requested_at >= ?');
      params.push(filters.since);
    }

    let query = 'SELECT COUNT(*) as count FROM assessments';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const result = this.db.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Count history rows matching filters
   */
  public countHistory(filters: AssessmentFilters = {}): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters.run_id) {
      conditions.push('run_id = ?');
      params.push(filters.run_id);
    }
    if (filters.pillar) {
      const pillars = Array.isArray(filters.pillar) ? filters.pillar : [filters.pillar];
      conditions.push(`pillar IN (${pillars.map(() => '?').join(',')})`);
      params.push(...pillars);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (filters.since) {
      conditions.push('assessed_at >= ?');
      params.push(filters.since);
    }

    let query = 'SELECT COUNT(*) as count FROM assessment_history';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const result = this.db.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  private rowToRunRecord(row: AssessmentRow): AssessmentRunRecord {
    return {
      run_id: row.run_id,
      mode: AssessmentRunModeSchema.parse(row.mode),
      state: AssessmentLifecycleStateSchema.parse(row.state),
      requested_at: row.requested_at,
      started_at: row.started_at ?? undefined,
      completed_at: row.completed_at ?? undefined,
      total_checks: row.total_checks,
      completed_checks: row.completed_checks,
      passed_checks: row.passed_checks,
      failed_checks: row.failed_checks,
      warning_checks: row.warning_checks,
      skipped_checks: row.skipped_checks,
      error_checks: row.error_checks,
      timeout_checks: row.timeout_checks,
      failure_reason: row.failure_reason ?? undefined,
    };
  }
}

