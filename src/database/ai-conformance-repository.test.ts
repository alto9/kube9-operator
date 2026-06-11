import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { AiConformanceRepository } from './ai-conformance-repository.js';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-ai-conformance-repo-temp');

describe('AiConformanceRepository', () => {
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

  it('upserts runs and inserts requirement results', () => {
    const repo = new AiConformanceRepository();
    const runId = 'run-001';
    const evaluatedAt = '2026-06-11T12:00:00.000Z';

    repo.upsertRun({
      run_id: runId,
      checklist_version: 'KubernetesAIConformance-1.31',
      kubernetes_minor: '1.31',
      source_revision: 'bundle-2026.1',
      state: 'completed',
      requested_at: evaluatedAt,
      started_at: evaluatedAt,
      completed_at: evaluatedAt,
      total_requirements: 2,
      must_requirements: 1,
      should_requirements: 1,
      passed_count: 1,
      failed_count: 1,
      warning_count: 0,
      not_applicable_count: 0,
      not_evaluated_count: 0,
      needs_evidence_count: 0,
      failure_reason: null,
    });

    repo.insertRequirementResults(runId, [
      {
        requirement_id: 'security.rbac-least-privilege',
        category: 'security',
        level: 'MUST',
        title: 'Enforce least-privilege RBAC',
        status: 'passed',
        rationale: 'No wildcard RBAC detected.',
        evidence_ref: 'k8s.rbac.authorization/v1',
        evaluated_at: evaluatedAt,
      },
      {
        requirement_id: 'reliability.pod-disruption-budgets',
        category: 'reliability',
        level: 'SHOULD',
        title: 'Pod disruption budgets',
        status: 'failed',
        rationale: 'Missing PDB on app/default/api.',
        evidence_ref: 'k8s.policy/v1',
        evaluated_at: evaluatedAt,
      },
    ]);

    const run = repo.getRunById(runId);
    expect(run?.state).toBe('completed');
    expect(run?.passed_count).toBe(1);
    expect(run?.failed_count).toBe(1);

    const results = repo.getRequirementResultsForRun(runId);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.requirement_id).sort()).toEqual([
      'reliability.pod-disruption-budgets',
      'security.rbac-least-privilege',
    ]);
  });

  it('returns latest run and builds bounded summary', () => {
    const repo = new AiConformanceRepository();
    const older = '2026-06-10T12:00:00.000Z';
    const newer = '2026-06-11T12:00:00.000Z';

    repo.upsertRun({
      run_id: 'run-old',
      checklist_version: 'KubernetesAIConformance-1.30',
      kubernetes_minor: '1.30',
      source_revision: 'bundle-2026.1',
      state: 'completed',
      requested_at: older,
      started_at: older,
      completed_at: older,
      total_requirements: 1,
      must_requirements: 1,
      should_requirements: 0,
      passed_count: 1,
      failed_count: 0,
      warning_count: 0,
      not_applicable_count: 0,
      not_evaluated_count: 0,
      needs_evidence_count: 0,
    });

    repo.upsertRun({
      run_id: 'run-new',
      checklist_version: 'KubernetesAIConformance-1.31',
      kubernetes_minor: '1.31',
      source_revision: 'bundle-2026.1',
      state: 'partial',
      requested_at: newer,
      started_at: newer,
      completed_at: newer,
      total_requirements: 2,
      must_requirements: 1,
      should_requirements: 1,
      passed_count: 0,
      failed_count: 0,
      warning_count: 0,
      not_applicable_count: 0,
      not_evaluated_count: 1,
      needs_evidence_count: 1,
    });

    repo.insertRequirementResults('run-new', [
      {
        requirement_id: 'security.secrets-encryption-at-rest',
        category: 'security',
        level: 'MUST',
        title: 'Secrets encryption at rest',
        status: 'needs-evidence',
        rationale: 'Requires external etcd encryption evidence.',
        evidence_ref: 'external:etcd-encryption-config',
        evaluated_at: newer,
      },
      {
        requirement_id: 'observability.audit-logging',
        category: 'operational-excellence',
        level: 'SHOULD',
        title: 'Audit logging enabled',
        status: 'not-evaluated',
        rationale: 'Audit policy not observable from API.',
        evidence_ref: null,
        evaluated_at: newer,
      },
    ]);

    const latest = repo.getLatestRun();
    expect(latest?.run_id).toBe('run-new');

    const summary = repo.buildLatestSummary();
    expect(summary.runId).toBe('run-new');
    expect(summary.lastOutcome).toBe('success');
    expect(summary.totals.needsEvidence).toBe(1);
    expect(summary.totals.notEvaluated).toBe(1);
    expect(summary.categories.security?.needsEvidence).toBe(1);
    expect(summary.requirements).toHaveLength(2);
    expect(summary.requirements[0]?.rationale.length).toBeLessThanOrEqual(420);
  });

  it('persists failed runs with bounded failure reason', () => {
    const repo = new AiConformanceRepository();
    const longReason = 'x'.repeat(200);

    repo.upsertRun({
      run_id: 'run-failed',
      checklist_version: 'unknown',
      kubernetes_minor: 'unknown',
      source_revision: null,
      state: 'failed',
      requested_at: '2026-06-11T12:00:00.000Z',
      started_at: '2026-06-11T12:00:00.000Z',
      completed_at: '2026-06-11T12:00:00.000Z',
      total_requirements: 0,
      must_requirements: 0,
      should_requirements: 0,
      passed_count: 0,
      failed_count: 0,
      warning_count: 0,
      not_applicable_count: 0,
      not_evaluated_count: 0,
      needs_evidence_count: 0,
      failure_reason: longReason.slice(0, 120),
    });

    const summary = repo.buildLatestSummary();
    expect(summary.lastOutcome).toBe('failed');
    expect(summary.error?.length).toBeLessThanOrEqual(420);
  });
});
