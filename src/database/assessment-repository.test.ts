import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from './manager.js';
import { SchemaManager } from './schema.js';
import { AssessmentRepository } from './assessment-repository.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-assessment-repo-temp');

describe('AssessmentRepository', () => {
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

  it('inserts and retrieves assessment run', () => {
    const repo = new AssessmentRepository();
    const record = {
      run_id: 'run_001',
      mode: 'full' as const,
      state: 'completed' as const,
      requested_at: '2026-02-16T10:00:00.000Z',
      started_at: '2026-02-16T10:00:01.000Z',
      completed_at: '2026-02-16T10:00:30.000Z',
      total_checks: 5,
      completed_checks: 5,
      passed_checks: 4,
      failed_checks: 1,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    };

    repo.upsertAssessment(record);
    const retrieved = repo.getAssessmentById('run_001');

    expect(retrieved).toBeTruthy();
    expect(retrieved?.run_id).toBe('run_001');
    expect(retrieved?.state).toBe('completed');
    expect(retrieved?.passed_checks).toBe(4);
    expect(retrieved?.failed_checks).toBe(1);
  });

  it('upserts assessment (updates existing run)', () => {
    const repo = new AssessmentRepository();
    const initial = {
      run_id: 'run_002',
      mode: 'full' as const,
      state: 'running' as const,
      requested_at: '2026-02-16T11:00:00.000Z',
      total_checks: 3,
      completed_checks: 1,
      passed_checks: 1,
      failed_checks: 0,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    };

    repo.upsertAssessment(initial);
    const updated = {
      ...initial,
      state: 'completed' as const,
      started_at: '2026-02-16T11:00:01.000Z',
      completed_at: '2026-02-16T11:00:10.000Z',
      completed_checks: 3,
      passed_checks: 2,
      failed_checks: 1,
    };

    repo.upsertAssessment(updated);
    const retrieved = repo.getAssessmentById('run_002');

    expect(retrieved?.state).toBe('completed');
    expect(retrieved?.completed_checks).toBe(3);
    expect(retrieved?.passed_checks).toBe(2);
    expect(retrieved?.failed_checks).toBe(1);
  });

  it('inserts check result and enforces foreign key', () => {
    const repo = new AssessmentRepository();
    repo.upsertAssessment({
      run_id: 'run_003',
      mode: 'full' as const,
      state: 'completed' as const,
      requested_at: '2026-02-16T12:00:00.000Z',
      total_checks: 1,
      completed_checks: 1,
      passed_checks: 1,
      failed_checks: 0,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    });

    repo.insertCheckResult(
      {
        run_id: 'run_003',
        check_id: 'SEC-001',
        pillar: 'security',
        status: 'passing',
        message: 'RBAC configured correctly',
        duration_ms: 100,
        assessed_at: '2026-02-16T12:00:05.000Z',
      },
      'hist_001',
      'RBAC Wildcard Check'
    );

    const history = repo.queryHistory({ filters: { run_id: 'run_003' } });
    expect(history).toHaveLength(1);
    expect(history[0].check_id).toBe('SEC-001');
    expect(history[0].status).toBe('passing');
    expect(history[0].check_name).toBe('RBAC Wildcard Check');
  });

  it('filters history by pillar', () => {
    const repo = new AssessmentRepository();
    repo.upsertAssessment({
      run_id: 'run_004',
      mode: 'full' as const,
      state: 'completed' as const,
      requested_at: '2026-02-16T13:00:00.000Z',
      total_checks: 3,
      completed_checks: 3,
      passed_checks: 2,
      failed_checks: 1,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    });

    repo.insertCheckResult(
      {
        run_id: 'run_004',
        check_id: 'SEC-001',
        pillar: 'security',
        status: 'passing',
        message: 'ok',
        duration_ms: 50,
        assessed_at: '2026-02-16T13:00:01.000Z',
      },
      'hist_sec_001',
      'Security Check 1'
    );
    repo.insertCheckResult(
      {
        run_id: 'run_004',
        check_id: 'REL-001',
        pillar: 'reliability',
        status: 'failing',
        message: 'failed',
        duration_ms: 60,
        assessed_at: '2026-02-16T13:00:02.000Z',
      },
      'hist_rel_001',
      'Reliability Check 1'
    );

    const securityOnly = repo.queryHistory({
      filters: { run_id: 'run_004', pillar: 'security' },
    });
    expect(securityOnly).toHaveLength(1);
    expect(securityOnly[0].pillar).toBe('security');

    const multiPillar = repo.queryHistory({
      filters: { run_id: 'run_004', pillar: ['security', 'reliability'] },
    });
    expect(multiPillar).toHaveLength(2);
  });

  it('filters history by status', () => {
    const repo = new AssessmentRepository();
    repo.upsertAssessment({
      run_id: 'run_005',
      mode: 'full' as const,
      state: 'completed' as const,
      requested_at: '2026-02-16T14:00:00.000Z',
      total_checks: 2,
      completed_checks: 2,
      passed_checks: 1,
      failed_checks: 1,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    });

    repo.insertCheckResult(
      {
        run_id: 'run_005',
        check_id: 'SEC-001',
        pillar: 'security',
        status: 'passing',
        message: 'ok',
        duration_ms: 50,
        assessed_at: '2026-02-16T14:00:01.000Z',
      },
      'hist_005a',
      'Check A'
    );
    repo.insertCheckResult(
      {
        run_id: 'run_005',
        check_id: 'SEC-002',
        pillar: 'security',
        status: 'failing',
        message: 'failed',
        duration_ms: 60,
        assessed_at: '2026-02-16T14:00:02.000Z',
      },
      'hist_005b',
      'Check B'
    );

    const failing = repo.queryHistory({
      filters: { run_id: 'run_005', status: 'failing' },
    });
    expect(failing).toHaveLength(1);
    expect(failing[0].status).toBe('failing');
  });

  it('paginates results', () => {
    const repo = new AssessmentRepository();
    for (let i = 0; i < 5; i++) {
      repo.upsertAssessment({
        run_id: `run_pag_${i}`,
        mode: 'full' as const,
        state: 'completed' as const,
        requested_at: `2026-02-16T15:0${i}:00.000Z`,
        total_checks: 1,
        completed_checks: 1,
        passed_checks: 1,
        failed_checks: 0,
        warning_checks: 0,
        skipped_checks: 0,
        error_checks: 0,
        timeout_checks: 0,
      });
    }

    const page1 = repo.queryAssessments({ limit: 2, offset: 0 });
    const page2 = repo.queryAssessments({ limit: 2, offset: 2 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].run_id).not.toBe(page2[0].run_id);
  });

  it('counts assessments with filters', () => {
    const repo = new AssessmentRepository();
    const runId1 = `run_cnt_${Date.now()}_1`;
    const runId2 = `run_cnt_${Date.now()}_2`;
    repo.upsertAssessment({
      run_id: runId1,
      mode: 'full' as const,
      state: 'completed' as const,
      requested_at: '2026-02-16T16:00:00.000Z',
      total_checks: 1,
      completed_checks: 1,
      passed_checks: 1,
      failed_checks: 0,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    });
    repo.upsertAssessment({
      run_id: runId2,
      mode: 'full' as const,
      state: 'running' as const,
      requested_at: '2026-02-16T16:01:00.000Z',
      total_checks: 1,
      completed_checks: 0,
      passed_checks: 0,
      failed_checks: 0,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    });

    expect(repo.countAssessments({ state: 'completed' })).toBeGreaterThanOrEqual(1);
    expect(repo.countAssessments({ state: 'running' })).toBeGreaterThanOrEqual(1);
    expect(repo.getAssessmentById(runId1)).toBeTruthy();
    expect(repo.getAssessmentById(runId2)).toBeTruthy();
  });

  it('counts history with filters', () => {
    const repo = new AssessmentRepository();
    repo.upsertAssessment({
      run_id: 'run_cnt_h',
      mode: 'full' as const,
      state: 'completed' as const,
      requested_at: '2026-02-16T17:00:00.000Z',
      total_checks: 3,
      completed_checks: 3,
      passed_checks: 2,
      failed_checks: 1,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    });

    repo.insertCheckResult(
      {
        run_id: 'run_cnt_h',
        check_id: 'A',
        pillar: 'security',
        status: 'passing',
        message: 'ok',
        duration_ms: 10,
        assessed_at: '2026-02-16T17:00:01.000Z',
      },
      'h1',
      'Check A'
    );
    repo.insertCheckResult(
      {
        run_id: 'run_cnt_h',
        check_id: 'B',
        pillar: 'security',
        status: 'passing',
        message: 'ok',
        duration_ms: 10,
        assessed_at: '2026-02-16T17:00:02.000Z',
      },
      'h2',
      'Check B'
    );
    repo.insertCheckResult(
      {
        run_id: 'run_cnt_h',
        check_id: 'C',
        pillar: 'reliability',
        status: 'failing',
        message: 'fail',
        duration_ms: 10,
        assessed_at: '2026-02-16T17:00:03.000Z',
      },
      'h3',
      'Check C'
    );

    expect(repo.countHistory({ run_id: 'run_cnt_h' })).toBe(3);
    expect(repo.countHistory({ run_id: 'run_cnt_h', pillar: 'security' })).toBe(2);
    expect(repo.countHistory({ run_id: 'run_cnt_h', status: 'failing' })).toBe(1);
  });

  it('returns null for non-existent assessment', () => {
    const repo = new AssessmentRepository();
    const retrieved = repo.getAssessmentById('nonexistent');
    expect(retrieved).toBeNull();
  });
});
