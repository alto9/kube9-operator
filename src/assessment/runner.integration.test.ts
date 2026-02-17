/**
 * Integration tests for AssessmentRunner - end-to-end execution with SQLite.
 * Run with: npm run test:integration -- src/assessment/runner.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/manager.js';
import { SchemaManager } from '../database/schema.js';
import { AssessmentRepository } from '../database/assessment-repository.js';
import { AssessmentRunner } from './runner.js';
import { getRegistry, resetRegistry } from './registry.js';
import type { AssessmentCheck, AssessmentCheckResult } from './types.js';
import { Pillar, CheckStatus, AssessmentRunMode } from './types.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-runner-integration-temp');

function createMockCheck(overrides: Partial<AssessmentCheck> = {}): AssessmentCheck {
  return {
    id: 'security.integration-check',
    name: 'Integration Security Check',
    pillar: Pillar.Security,
    run: async (): Promise<AssessmentCheckResult> => ({
      checkId: 'security.integration-check',
      pillar: Pillar.Security,
      status: CheckStatus.Passing,
      message: 'E2E OK',
    }),
    ...overrides,
  };
}

const mockKubernetes = {} as never;
const mockConfig = {
  serverUrl: 'https://test',
  logLevel: 'info',
  statusUpdateIntervalSeconds: 60,
  reregistrationIntervalHours: 24,
  clusterMetadataIntervalSeconds: 86400,
  resourceInventoryIntervalSeconds: 21600,
  resourceConfigurationPatternsIntervalSeconds: 43200,
  eventRetentionInfoWarningDays: 7,
  eventRetentionErrorCriticalDays: 30,
} as never;
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as never;

describe('AssessmentRunner (integration)', () => {
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
    resetRegistry();
    DatabaseManager.reset();
    const schema = new SchemaManager();
    schema.initialize();
  });

  it('writes expected records to SQLite on successful run', async () => {
    const check = createMockCheck({
      id: 'sec.e2e',
      run: async () => ({
        checkId: 'sec.e2e',
        pillar: Pillar.Security,
        status: CheckStatus.Passing,
        message: 'Cluster validated',
      }),
    });
    getRegistry().bootstrap([check]);

    const storage = new AssessmentRepository();
    const runner = new AssessmentRunner({
      kubernetes: mockKubernetes,
      config: mockConfig,
      logger: mockLogger,
      storage,
    });

    const record = await runner.run({
      runId: 'run-e2e-001',
      mode: AssessmentRunMode.Full,
    });

    expect(record.run_id).toBe('run-e2e-001');
    expect(record.state).toBe('completed');
    expect(record.passed_checks).toBe(1);

    const retrieved = storage.getAssessmentById('run-e2e-001');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.state).toBe('completed');

    const history = storage.queryHistory({ filters: { run_id: 'run-e2e-001' } });
    expect(history).toHaveLength(1);
    expect(history[0].check_id).toBe('sec.e2e');
    expect(history[0].status).toBe('passing');
    expect(history[0].message).toBe('Cluster validated');
  });

  it('persists partial failure results to SQLite', async () => {
    const passCheck = createMockCheck({
      id: 'sec.pass',
      run: async () => ({
        checkId: 'sec.pass',
        pillar: Pillar.Security,
        status: CheckStatus.Passing,
        message: 'OK',
      }),
    });
    const failCheck = createMockCheck({
      id: 'sec.fail',
      run: async () => ({
        checkId: 'sec.fail',
        pillar: Pillar.Security,
        status: CheckStatus.Failing,
        message: 'RBAC misconfigured',
      }),
    });
    getRegistry().bootstrap([passCheck, failCheck]);

    const storage = new AssessmentRepository();
    const runner = new AssessmentRunner({
      kubernetes: mockKubernetes,
      config: mockConfig,
      logger: mockLogger,
      storage,
    });

    const record = await runner.run({
      runId: 'run-e2e-partial',
      mode: AssessmentRunMode.Full,
    });

    expect(record.passed_checks).toBe(1);
    expect(record.failed_checks).toBe(1);
    expect(record.state).toBe('completed');

    const history = storage.queryHistory({ filters: { run_id: 'run-e2e-partial' } });
    expect(history).toHaveLength(2);
    const passing = history.find((h) => h.status === 'passing');
    const failing = history.find((h) => h.status === 'failing');
    expect(passing).toBeTruthy();
    expect(failing).toBeTruthy();
    expect(failing?.message).toBe('RBAC misconfigured');
  });
});
