import { describe, expect, it } from 'vitest';
import {
  AssessmentCheckResultSchema,
  AssessmentLifecycleStateSchema,
  AssessmentRunRecordSchema,
  AssessmentRunRequestSchema,
  canTransitionAssessmentState,
} from './contracts.js';

describe('assessment contracts', () => {
  it('accepts all required lifecycle states', () => {
    const states = ['queued', 'running', 'completed', 'failed', 'partial'];
    const parsed = states.map((state) => AssessmentLifecycleStateSchema.parse(state));
    expect(parsed).toEqual(states);
  });

  it('validates full assessment request contract', () => {
    const request = AssessmentRunRequestSchema.parse({
      mode: 'full',
      request_id: 'req_123',
      initiated_by: 'scheduler',
    });

    expect(request.mode).toBe('full');
  });

  it('validates pillar-filtered request contract', () => {
    const request = AssessmentRunRequestSchema.parse({
      mode: 'pillar',
      request_id: 'req_124',
      initiated_by: 'cli',
      pillar: 'security',
    });

    expect(request.mode).toBe('pillar');
    if (request.mode === 'pillar') expect(request.pillar).toBe('security');
  });

  it('validates single-check request contract', () => {
    const request = AssessmentRunRequestSchema.parse({
      mode: 'single-check',
      request_id: 'req_125',
      initiated_by: 'cli',
      check_id: 'security-rbac-wildcard',
    });

    expect(request.mode).toBe('single-check');
    if (request.mode === 'single-check') expect(request.check_id).toBe('security-rbac-wildcard');
  });

  it('accepts per-check failure semantics with error_code', () => {
    const result = AssessmentCheckResultSchema.parse({
      run_id: 'run_abc',
      check_id: 'security-rbac-wildcard',
      pillar: 'security',
      status: 'error',
      message: 'check timed out',
      remediation: 'increase timeout or optimize API query',
      duration_ms: 15000,
      assessed_at: '2026-02-16T01:00:00.000Z',
      error_code: 'CHECK_TIMEOUT',
    });

    expect(result.error_code).toBe('CHECK_TIMEOUT');
  });

  it('accepts timeout status for per-check results', () => {
    const result = AssessmentCheckResultSchema.parse({
      run_id: 'run_xyz',
      check_id: 'SEC-001',
      pillar: 'security',
      status: 'timeout',
      message: 'check exceeded 30s limit',
      duration_ms: 30000,
      assessed_at: '2026-02-16T02:00:00.000Z',
    });

    expect(result.status).toBe('timeout');
  });

  it('validates partial run summary contract', () => {
    const run = AssessmentRunRecordSchema.parse({
      run_id: 'run_partial',
      mode: 'full',
      state: 'partial',
      requested_at: '2026-02-16T01:00:00.000Z',
      started_at: '2026-02-16T01:00:01.000Z',
      completed_at: '2026-02-16T01:00:10.000Z',
      total_checks: 5,
      completed_checks: 5,
      passed_checks: 3,
      failed_checks: 1,
      warning_checks: 0,
      skipped_checks: 0,
      error_checks: 1,
      timeout_checks: 1,
      failure_reason: '1 check exceeded timeout',
    });

    expect(run.state).toBe('partial');
  });

  it('allows only valid lifecycle transitions', () => {
    expect(canTransitionAssessmentState('queued', 'running')).toBe(true);
    expect(canTransitionAssessmentState('running', 'completed')).toBe(true);
    expect(canTransitionAssessmentState('running', 'partial')).toBe(true);
    expect(canTransitionAssessmentState('completed', 'running')).toBe(false);
    expect(canTransitionAssessmentState('failed', 'completed')).toBe(false);
  });
});
