/**
 * SQLite persistence for Kubernetes AI Conformance runs and requirement results.
 */

import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { DatabaseManager } from './manager.js';
import {
  AiConformanceRequirementResultRecordSchema,
  AiConformanceRunRecordSchema,
  type AiConformanceRequirementResultRecord,
  type AiConformanceRunRecord,
} from './ai-conformance-contracts.js';
import type { EvaluatedRequirementResult } from '../ai-conformance/contracts.js';
import type { AiConformanceLatestSummary } from '../ai-conformance/contracts.js';
import {
  buildBoundedRequirementSummaries,
  buildCategoryRollups,
} from '../ai-conformance/summary.js';
import { boundConformanceText } from '../ai-conformance/contracts.js';

export interface AiConformanceRunRow {
  run_id: string;
  checklist_version: string;
  kubernetes_minor: string;
  source_revision: string | null;
  state: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_requirements: number;
  must_requirements: number;
  should_requirements: number;
  passed_count: number;
  failed_count: number;
  warning_count: number;
  not_applicable_count: number;
  not_evaluated_count: number;
  needs_evidence_count: number;
  failure_reason: string | null;
}

export interface AiConformanceRequirementResultRow {
  id: string;
  run_id: string;
  requirement_id: string;
  category: string;
  level: string;
  title: string;
  status: string;
  rationale: string;
  evidence_ref: string | null;
  evaluated_at: string;
}

const EMPTY_SUMMARY: AiConformanceLatestSummary = {
  checklistVersion: 'unknown',
  kubernetesMinor: 'unknown',
  sourceRevision: null,
  lastCompletedAt: null,
  lastOutcome: 'none',
  runState: null,
  runId: null,
  totals: {
    totalRequirements: 0,
    mustRequirements: 0,
    shouldRequirements: 0,
    passed: 0,
    failed: 0,
    warning: 0,
    notApplicable: 0,
    notEvaluated: 0,
    needsEvidence: 0,
  },
  categories: {},
  requirements: [],
  error: null,
};

export class AiConformanceRepository {
  private db: Database.Database;

  constructor() {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
  }

  private tableReady(): boolean {
    const row = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ai_conformance_runs'`)
      .get() as { name: string } | undefined;
    return row !== undefined;
  }

  public upsertRun(record: AiConformanceRunRecord): void {
    const validated = AiConformanceRunRecordSchema.parse(record);
    const stmt = this.db.prepare(`
      INSERT INTO ai_conformance_runs (
        run_id, checklist_version, kubernetes_minor, source_revision, state,
        requested_at, started_at, completed_at,
        total_requirements, must_requirements, should_requirements,
        passed_count, failed_count, warning_count,
        not_applicable_count, not_evaluated_count, needs_evidence_count,
        failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        state = excluded.state,
        started_at = COALESCE(excluded.started_at, started_at),
        completed_at = COALESCE(excluded.completed_at, completed_at),
        total_requirements = excluded.total_requirements,
        must_requirements = excluded.must_requirements,
        should_requirements = excluded.should_requirements,
        passed_count = excluded.passed_count,
        failed_count = excluded.failed_count,
        warning_count = excluded.warning_count,
        not_applicable_count = excluded.not_applicable_count,
        not_evaluated_count = excluded.not_evaluated_count,
        needs_evidence_count = excluded.needs_evidence_count,
        failure_reason = excluded.failure_reason
    `);

    stmt.run(
      validated.run_id,
      validated.checklist_version,
      validated.kubernetes_minor,
      validated.source_revision ?? null,
      validated.state,
      validated.requested_at,
      validated.started_at ?? null,
      validated.completed_at ?? null,
      validated.total_requirements,
      validated.must_requirements,
      validated.should_requirements,
      validated.passed_count,
      validated.failed_count,
      validated.warning_count,
      validated.not_applicable_count,
      validated.not_evaluated_count,
      validated.needs_evidence_count,
      validated.failure_reason ?? null
    );
  }

  public insertRequirementResults(
    runId: string,
    results: EvaluatedRequirementResult[]
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO ai_conformance_requirement_results (
        id, run_id, requirement_id, category, level, title,
        status, rationale, evidence_ref, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((rows: EvaluatedRequirementResult[]) => {
      for (const row of rows) {
        const record: AiConformanceRequirementResultRecord = {
          id: randomUUID(),
          run_id: runId,
          requirement_id: row.requirement_id,
          category: row.category,
          level: row.level,
          title: row.title,
          status: row.status,
          rationale: row.rationale,
          evidence_ref: row.evidence_ref ?? null,
          evaluated_at: row.evaluated_at,
        };
        const validated = AiConformanceRequirementResultRecordSchema.parse(record);
        stmt.run(
          validated.id,
          validated.run_id,
          validated.requirement_id,
          validated.category,
          validated.level,
          validated.title,
          validated.status,
          validated.rationale,
          validated.evidence_ref ?? null,
          validated.evaluated_at
        );
      }
    });

    insertMany(results);
  }

  public getRunById(runId: string): AiConformanceRunRecord | null {
    const row = this.db
      .prepare('SELECT * FROM ai_conformance_runs WHERE run_id = ?')
      .get(runId) as AiConformanceRunRow | undefined;
    if (!row) {
      return null;
    }
    return this.rowToRunRecord(row);
  }

  public getLatestRun(): AiConformanceRunRecord | null {
    const row = this.db
      .prepare(`
        SELECT * FROM ai_conformance_runs
        ORDER BY COALESCE(completed_at, requested_at) DESC
        LIMIT 1
      `)
      .get() as AiConformanceRunRow | undefined;
    if (!row) {
      return null;
    }
    return this.rowToRunRecord(row);
  }

  public getRequirementResultsForRun(runId: string): EvaluatedRequirementResult[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM ai_conformance_requirement_results
        WHERE run_id = ?
        ORDER BY category ASC, requirement_id ASC
      `)
      .all(runId) as AiConformanceRequirementResultRow[];

    return rows.map((row) => ({
      requirement_id: row.requirement_id,
      category: row.category,
      level: row.level as EvaluatedRequirementResult['level'],
      title: row.title,
      status: row.status as EvaluatedRequirementResult['status'],
      rationale: row.rationale,
      evidence_ref: row.evidence_ref,
      evaluated_at: row.evaluated_at,
    }));
  }

  public buildLatestSummary(): AiConformanceLatestSummary {
    if (!this.tableReady()) {
      return EMPTY_SUMMARY;
    }

    const run = this.getLatestRun();
    if (!run) {
      return EMPTY_SUMMARY;
    }

    const results = this.getRequirementResultsForRun(run.run_id);
    const lastOutcome =
      run.state === 'failed' ? 'failed' : run.state === 'completed' || run.state === 'partial'
        ? 'success'
        : 'none';

    return {
      checklistVersion: run.checklist_version,
      kubernetesMinor: run.kubernetes_minor,
      sourceRevision: run.source_revision ?? null,
      lastCompletedAt: run.completed_at ?? null,
      lastOutcome,
      runState: run.state,
      runId: run.run_id,
      totals: {
        totalRequirements: run.total_requirements,
        mustRequirements: run.must_requirements,
        shouldRequirements: run.should_requirements,
        passed: run.passed_count,
        failed: run.failed_count,
        warning: run.warning_count,
        notApplicable: run.not_applicable_count,
        notEvaluated: run.not_evaluated_count,
        needsEvidence: run.needs_evidence_count,
      },
      categories: buildCategoryRollups(results),
      requirements: buildBoundedRequirementSummaries(results),
      error:
        run.state === 'failed' && run.failure_reason
          ? boundConformanceText(run.failure_reason)
          : null,
    };
  }

  private rowToRunRecord(row: AiConformanceRunRow): AiConformanceRunRecord {
    return AiConformanceRunRecordSchema.parse({
      run_id: row.run_id,
      checklist_version: row.checklist_version,
      kubernetes_minor: row.kubernetes_minor,
      source_revision: row.source_revision,
      state: row.state,
      requested_at: row.requested_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      total_requirements: row.total_requirements,
      must_requirements: row.must_requirements,
      should_requirements: row.should_requirements,
      passed_count: row.passed_count,
      failed_count: row.failed_count,
      warning_count: row.warning_count,
      not_applicable_count: row.not_applicable_count,
      not_evaluated_count: row.not_evaluated_count,
      needs_evidence_count: row.needs_evidence_count,
      failure_reason: row.failure_reason,
    });
  }
}
