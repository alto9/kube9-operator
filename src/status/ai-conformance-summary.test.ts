import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/manager.js';
import { SchemaManager } from '../database/schema.js';
import { AiConformanceRepository } from '../database/ai-conformance-repository.js';
import { CONFORMANCE_STATUS_FIELD_MAX } from '../ai-conformance/contracts.js';
import { calculateStatus } from './calculator.js';
import {
  DEFAULT_AI_CONFORMANCE_SUMMARY,
  buildAiConformanceScheduleContextFromConfig,
  buildAiConformanceStatusSummary,
  loadLatestPersistedAiConformanceSummary,
} from './ai-conformance-summary.js';
import type { Config } from '../config/types.js';

const testDbDir = path.join(process.cwd(), 'test-ai-conformance-status-temp');

const baseConfig: Config = {
  logLevel: 'info',
  statusUpdateIntervalSeconds: 60,
  clusterMetadataIntervalSeconds: 86400,
  resourceInventoryIntervalSeconds: 21600,
  resourceConfigurationPatternsIntervalSeconds: 43200,
  workloadImageScanIntervalSeconds: 86400,
  argocdApplicationStatusIntervalSeconds: 3600,
  eventRetentionInfoWarningDays: 7,
  eventRetentionErrorCriticalDays: 30,
  assessmentEnabled: false,
  assessmentIntervalSeconds: 86400,
  assessmentMode: 'full',
  aiConformanceEnabled: true,
  aiConformanceIntervalSeconds: 86400,
  aiConformanceChecklistSource: 'bundled',
};

describe('ai-conformance status summary', () => {
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

  it('returns stable no-run summary before any persisted run', () => {
    const repo = new AiConformanceRepository();
    const latest = loadLatestPersistedAiConformanceSummary(repo);
    expect(latest.lastOutcome).toBe('none');
    expect(latest.requirements).toEqual([]);

    const summary = buildAiConformanceStatusSummary(
      latest,
      buildAiConformanceScheduleContextFromConfig(baseConfig)
    );
    expect(summary).toMatchObject({
      checklistVersion: 'unknown',
      kubernetesMinor: 'unknown',
      lastOutcome: 'none',
      schedulingEnabled: true,
      scheduleIntervalSeconds: 86400,
      checklistSource: 'bundled',
    });
  });

  it('maps failed persisted runs with bounded error text into status', () => {
    const repo = new AiConformanceRepository();
    const longError = 'x'.repeat(CONFORMANCE_STATUS_FIELD_MAX + 50);
    repo.upsertRun({
      run_id: 'run-failed',
      checklist_version: 'KubernetesAIConformance-1.31',
      kubernetes_minor: '1.31',
      source_revision: 'bundle-test',
      state: 'failed',
      requested_at: '2026-06-11T12:00:00.000Z',
      started_at: '2026-06-11T12:00:01.000Z',
      completed_at: '2026-06-11T12:00:02.000Z',
      total_requirements: 0,
      must_requirements: 0,
      should_requirements: 0,
      passed_count: 0,
      failed_count: 0,
      warning_count: 0,
      not_applicable_count: 0,
      not_evaluated_count: 0,
      needs_evidence_count: 0,
      failure_reason: longError,
    });

    const summary = buildAiConformanceStatusSummary(
      loadLatestPersistedAiConformanceSummary(repo),
      buildAiConformanceScheduleContextFromConfig({
        ...baseConfig,
        aiConformanceEnabled: false,
      })
    );

    expect(summary.lastOutcome).toBe('failed');
    expect(summary.runState).toBe('failed');
    expect(summary.error).toBeTruthy();
    expect(summary.error!.length).toBeLessThanOrEqual(CONFORMANCE_STATUS_FIELD_MAX);
    expect(summary.schedulingEnabled).toBe(false);
    expect(summary.scheduleIntervalSeconds).toBeNull();
  });

  it('includes bounded requirement rows in calculateStatus serialization', () => {
    const repo = new AiConformanceRepository();
    const evaluatedAt = '2026-06-11T12:00:00.000Z';
    repo.upsertRun({
      run_id: 'run-ok',
      checklist_version: 'KubernetesAIConformance-1.31',
      kubernetes_minor: '1.31',
      source_revision: 'bundle-test',
      state: 'completed',
      requested_at: evaluatedAt,
      started_at: evaluatedAt,
      completed_at: evaluatedAt,
      total_requirements: 1,
      must_requirements: 1,
      should_requirements: 0,
      passed_count: 1,
      failed_count: 0,
      warning_count: 0,
      not_applicable_count: 0,
      not_evaluated_count: 0,
      needs_evidence_count: 0,
      failure_reason: null,
    });
    repo.insertRequirementResults('run-ok', [
      {
        requirement_id: 'security.example',
        category: 'security',
        level: 'MUST',
        title: 'Example requirement',
        status: 'passed',
        rationale: 'Observable signal satisfied.',
        evidence_ref: 'k8s.rbac.authorization/v1',
        evaluated_at: evaluatedAt,
      },
    ]);

    const aiConformance = buildAiConformanceStatusSummary(
      loadLatestPersistedAiConformanceSummary(repo),
      buildAiConformanceScheduleContextFromConfig(baseConfig)
    );
    const status = calculateStatus(null, true, undefined, undefined, undefined, undefined, aiConformance);
    const parsed = JSON.parse(JSON.stringify(status));

    expect(parsed.aiConformance.lastOutcome).toBe('success');
    expect(parsed.aiConformance.requirements).toHaveLength(1);
    expect(parsed.aiConformance.requirements[0].id).toBe('security.example');
    expect(parsed.aiConformance.categories.security.total).toBe(1);
  });

  it('uses default no-run aiConformance when calculateStatus omits override', () => {
    const status = calculateStatus();
    expect(status.aiConformance).toEqual(DEFAULT_AI_CONFORMANCE_SUMMARY);
  });
});
