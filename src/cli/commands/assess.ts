/**
 * CLI Assessment Commands - Well-Architected Framework assessment operations
 */

import { z } from 'zod';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';
import { AssessmentRepository } from '../../database/assessment-repository.js';
import type { AssessmentFilters, AssessmentQueryOptions } from '../../database/assessment-repository.js';
import type { AssessmentHistoryRow } from '../../database/assessment-repository.js';
import { formatOutput } from '../formatters.js';
import { AssessmentRunner } from '../../assessment/runner.js';
import { bootstrapAssessmentRegistry } from '../../assessment/bootstrap.js';
import { AssessmentRunMode, Pillar, PILLAR_VALUES } from '../../assessment/types.js';
import { kubernetesClient } from '../../kubernetes/client.js';
import { loadConfig, setConfig } from '../../config/loader.js';
import { logger } from '../../logging/logger.js';

const PILLAR_OPTIONS = PILLAR_VALUES.join(', ');

const ListOptionsSchema = z.object({
  state: z.enum(['queued', 'running', 'completed', 'failed', 'partial']).optional(),
  limit: z
    .string()
    .default('50')
    .transform(Number)
    .pipe(z.number().int().positive().max(1000)),
  since: z.string().datetime().optional(),
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

const GetOptionsSchema = z.object({
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

const SummaryOptionsSchema = z.object({
  since: z.string().datetime().optional(),
  limit: z
    .string()
    .default('50')
    .transform(Number)
    .pipe(z.number().int().positive().max(100)),
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

const HistoryOptionsSchema = z.object({
  pillar: z.enum(PILLAR_VALUES as [string, ...string[]]).optional(),
  result: z.enum(['passing', 'failing', 'warning', 'skipped', 'error', 'timeout']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  limit: z
    .string()
    .default('100')
    .transform(Number)
    .pipe(z.number().int().positive().max(1000)),
  since: z.string().datetime().optional(),
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

const RunOptionsSchema = z.object({
  mode: z.enum(['full', 'pillar', 'single-check']).default('full'),
  pillar: z.string().optional(),
  checkId: z.string().optional(),
  timeoutMs: z
    .string()
    .default('30000')
    .transform(Number)
    .pipe(z.number().int().positive().max(300000)),
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

function writeError(message: string, details?: string) {
  const err = details ? { error: message, details } : { error: message };
  console.error(JSON.stringify(err));
  process.exit(1);
}

function ensureDb() {
  DatabaseManager.getInstance();
  const schema = new SchemaManager();
  schema.initialize();
}

function toApiRecord(record: {
  run_id: string;
  mode: string;
  state: string;
  requested_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  total_checks: number;
  completed_checks: number;
  passed_checks: number;
  failed_checks: number;
  warning_checks: number;
  skipped_checks: number;
  error_checks: number;
  timeout_checks: number;
  failure_reason?: string | null;
}) {
  return {
    run_id: record.run_id,
    mode: record.mode,
    state: record.state,
    requested_at: record.requested_at,
    started_at: record.started_at ?? undefined,
    completed_at: record.completed_at ?? undefined,
    total_checks: record.total_checks,
    completed_checks: record.completed_checks,
    passed_checks: record.passed_checks,
    failed_checks: record.failed_checks,
    warning_checks: record.warning_checks,
    skipped_checks: record.skipped_checks,
    error_checks: record.error_checks,
    timeout_checks: record.timeout_checks,
    failure_reason: record.failure_reason ?? undefined,
  };
}

function toApiHistoryRow(row: AssessmentHistoryRow) {
  return {
    id: row.id,
    run_id: row.run_id,
    check_id: row.check_id,
    pillar: row.pillar,
    check_name: row.check_name ?? undefined,
    status: row.status,
    message: row.message ?? undefined,
    remediation: row.remediation ?? undefined,
    assessed_at: row.assessed_at,
    duration_ms: row.duration_ms ?? undefined,
    error_code: row.error_code ?? undefined,
  };
}

export async function assessRun(options: Record<string, unknown>) {
  try {
    const validated = RunOptionsSchema.parse(options);

    if (validated.mode === 'pillar' && !validated.pillar) {
      writeError('--pillar is required when --mode is pillar', `Valid pillars: ${PILLAR_OPTIONS}`);
    }
    if (validated.mode === 'single-check' && !validated.checkId) {
      writeError('--check-id is required when --mode is single-check');
    }
    if (validated.pillar && !PILLAR_VALUES.includes(validated.pillar)) {
      writeError('Invalid pillar', `Valid pillars: ${PILLAR_OPTIONS}`);
    }

    ensureDb();
    bootstrapAssessmentRegistry();

    if (!process.env.SERVER_URL) {
      process.env.SERVER_URL = 'https://api.kube9.io';
    }
    const config = await loadConfig();
    setConfig(config);

    const runner = new AssessmentRunner({
      kubernetes: kubernetesClient,
      config,
      logger,
    });

    const mode = validated.mode as AssessmentRunMode;
    const input = {
      mode,
      pillarFilter: validated.pillar ? (validated.pillar as Pillar) : undefined,
      checkIdFilter: validated.checkId,
      timeoutMs: validated.timeoutMs,
    };

    const record = await runner.run(input);
    const apiRecord = toApiRecord(record);

    const output = formatOutput(apiRecord, validated.format);
    console.log(output);
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      const path = first.path.join('.');
      writeError(
        'Invalid arguments',
        path ? `${path}: ${first.message}` : first.message
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to run assessment', msg);
  }
}

export async function assessList(options: Record<string, unknown>) {
  try {
    const validated = ListOptionsSchema.parse(options);
    ensureDb();

    const filters: AssessmentFilters = {
      state: validated.state,
      since: validated.since,
    };

    const opts: AssessmentQueryOptions = {
      filters,
      limit: validated.limit,
      offset: 0,
    };

    const repo = new AssessmentRepository();
    const assessments = repo.queryAssessments(opts);
    const total = repo.countAssessments(filters);

    const result = {
      assessments: assessments.map(toApiRecord),
      pagination: {
        total,
        limit: validated.limit,
        offset: 0,
        returned: assessments.length,
      },
    };

    const output = formatOutput(result, validated.format);
    console.log(output);
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      const path = first.path.join('.');
      writeError(
        'Invalid arguments',
        path ? `${path}: ${first.message}` : first.message
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to list assessments', msg);
  }
}

export async function assessGet(assessmentId: string, options: Record<string, unknown>) {
  try {
    if (!assessmentId || assessmentId.trim() === '') {
      writeError('Assessment ID is required');
    }

    const validated = GetOptionsSchema.parse(options);
    ensureDb();

    const repo = new AssessmentRepository();
    const record = repo.getAssessmentById(assessmentId.trim());
    if (!record) {
      writeError('Assessment not found', `run_id: ${assessmentId}`);
    }
    const apiRecord = toApiRecord(record!);
    const output = formatOutput(apiRecord, validated.format);
    console.log(output);
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      writeError('Invalid arguments', first.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to get assessment', msg);
  }
}

export async function assessSummary(options: Record<string, unknown>) {
  try {
    const validated = SummaryOptionsSchema.parse(options);
    ensureDb();

    const filters: AssessmentFilters = { since: validated.since };
    const repo = new AssessmentRepository();
    const assessments = repo.queryAssessments({
      filters,
      limit: validated.limit,
      offset: 0,
    });

    const total = repo.countAssessments(filters);

    const summary = {
      total_runs: total,
      recent_runs: assessments.length,
      by_state: {} as Record<string, number>,
      by_mode: {} as Record<string, number>,
      totals: {
        passed_checks: 0,
        failed_checks: 0,
        warning_checks: 0,
        skipped_checks: 0,
        error_checks: 0,
        timeout_checks: 0,
      },
    };

    for (const a of assessments) {
      summary.by_state[a.state] = (summary.by_state[a.state] ?? 0) + 1;
      summary.by_mode[a.mode] = (summary.by_mode[a.mode] ?? 0) + 1;
      summary.totals.passed_checks += a.passed_checks;
      summary.totals.failed_checks += a.failed_checks;
      summary.totals.warning_checks += a.warning_checks;
      summary.totals.skipped_checks += a.skipped_checks;
      summary.totals.error_checks += a.error_checks;
      summary.totals.timeout_checks += a.timeout_checks;
    }

    const output = formatOutput(summary, validated.format);
    console.log(output);
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      writeError('Invalid arguments', first.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to get assessment summary', msg);
  }
}

export async function assessHistory(options: Record<string, unknown>) {
  try {
    const validated = HistoryOptionsSchema.parse(options);
    ensureDb();

    const filters: AssessmentFilters = {
      pillar: validated.pillar,
      status: validated.result,
      since: validated.since,
    };

    const opts: AssessmentQueryOptions = {
      filters,
      limit: validated.limit,
      offset: 0,
    };

    const repo = new AssessmentRepository();
    const history = repo.queryHistory(opts);
    const total = repo.countHistory(filters);

    const result = {
      history: history.map(toApiHistoryRow),
      pagination: {
        total,
        limit: validated.limit,
        offset: 0,
        returned: history.length,
      },
    };

    const output = formatOutput(result, validated.format);
    console.log(output);
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      const path = first.path.join('.');
      writeError(
        'Invalid arguments',
        path ? `${path}: ${first.message}` : first.message
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to list assessment history', msg);
  }
}
