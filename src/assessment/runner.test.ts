import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from './types.js';
import { Pillar, CheckStatus, AssessmentRunMode } from './types.js';
import { AssessmentRunner, resolveChecksForRun } from './runner.js';
import { getRegistry, resetRegistry } from './registry.js';
import type { AssessmentRunRecord, AssessmentCheckResult as StorageCheckResult } from './contracts.js';

/** Mock storage that records calls for verification */
class MockAssessmentStorage {
  public assessments: AssessmentRunRecord[] = [];
  public checkResults: Array<{ result: StorageCheckResult; id: string; checkName?: string }> = [];

  upsertAssessment(record: AssessmentRunRecord): void {
    this.assessments.push({ ...record });
  }

  insertCheckResult(
    result: StorageCheckResult,
    id: string,
    checkName?: string
  ): void {
    this.checkResults.push({ result: { ...result }, id, checkName });
  }
}

/** Creates a valid mock check */
function createMockCheck(overrides: Partial<AssessmentCheck> = {}): AssessmentCheck {
  return {
    id: 'security.test-check',
    name: 'Test Security Check',
    pillar: Pillar.Security,
    run: async (): Promise<AssessmentCheckResult> => ({
      checkId: 'security.test-check',
      pillar: Pillar.Security,
      status: CheckStatus.Passing,
      message: 'OK',
    }),
    ...overrides,
  };
}

const mockKubernetes = {} as Parameters<AssessmentRunner['run']>[0] extends { kubernetes: infer K }
  ? K
  : never;
const mockConfig = { serverUrl: 'https://test', logLevel: 'info' } as Parameters<
  AssessmentRunner['run']
>[0] extends { config: infer C }
  ? C
  : never;
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as Parameters<AssessmentRunner['run']>[0] extends { logger: infer L } ? L : never;

describe('AssessmentRunner', () => {
  let mockStorage: MockAssessmentStorage;

  beforeEach(() => {
    resetRegistry();
    mockStorage = new MockAssessmentStorage();
  });

  describe('resolveChecksForRun', () => {
    it('returns all checks for full mode', () => {
      const check1 = createMockCheck({ id: 'sec.a', pillar: Pillar.Security });
      const check2 = createMockCheck({ id: 'rel.b', pillar: Pillar.Reliability });
      getRegistry().bootstrap([check1, check2]);

      const checks = resolveChecksForRun({ mode: AssessmentRunMode.Full });
      expect(checks).toHaveLength(2);
      expect(checks.map((c) => c.id).sort()).toEqual(['rel.b', 'sec.a']);
    });

    it('returns pillar-filtered checks for pillar mode', () => {
      const check1 = createMockCheck({ id: 'sec.a', pillar: Pillar.Security });
      const check2 = createMockCheck({ id: 'rel.b', pillar: Pillar.Reliability });
      getRegistry().bootstrap([check1, check2]);

      const checks = resolveChecksForRun({
        mode: AssessmentRunMode.Pillar,
        pillarFilter: Pillar.Security,
      });
      expect(checks).toHaveLength(1);
      expect(checks[0].id).toBe('sec.a');
    });

    it('returns empty when pillar mode has no filter', () => {
      getRegistry().bootstrap([createMockCheck()]);
      const checks = resolveChecksForRun({ mode: AssessmentRunMode.Pillar });
      expect(checks).toHaveLength(0);
    });

    it('returns single check for single-check mode', () => {
      const check = createMockCheck({ id: 'sec.only' });
      getRegistry().bootstrap([check]);

      const checks = resolveChecksForRun({
        mode: AssessmentRunMode.SingleCheck,
        checkIdFilter: 'sec.only',
      });
      expect(checks).toHaveLength(1);
      expect(checks[0].id).toBe('sec.only');
    });

    it('returns empty when single-check id not found', () => {
      getRegistry().bootstrap([createMockCheck({ id: 'sec.a' })]);
      const checks = resolveChecksForRun({
        mode: AssessmentRunMode.SingleCheck,
        checkIdFilter: 'nonexistent',
      });
      expect(checks).toHaveLength(0);
    });
  });

  describe('run - success path', () => {
    it('executes checks and records passing results', async () => {
      const check = createMockCheck({
        id: 'sec.pass',
        run: async () => ({
          checkId: 'sec.pass',
          pillar: Pillar.Security,
          status: CheckStatus.Passing,
          message: 'All good',
        }),
      });
      getRegistry().bootstrap([check]);

      const runner = new AssessmentRunner({
        kubernetes: mockKubernetes,
        config: mockConfig,
        logger: mockLogger,
        storage: mockStorage as never,
      });

      const record = await runner.run({
        runId: 'run-success-1',
        mode: AssessmentRunMode.Full,
      });

      expect(record.run_id).toBe('run-success-1');
      expect(record.state).toBe('completed');
      expect(record.total_checks).toBe(1);
      expect(record.completed_checks).toBe(1);
      expect(record.passed_checks).toBe(1);
      expect(record.failed_checks).toBe(0);
      expect(record.error_checks).toBe(0);
      expect(record.timeout_checks).toBe(0);

      expect(mockStorage.assessments.length).toBeGreaterThanOrEqual(2);
      expect(mockStorage.checkResults).toHaveLength(1);
      expect(mockStorage.checkResults[0].result.status).toBe('passing');
    });
  });

  describe('run - partial failure path', () => {
    it('records partial failures without crashing', async () => {
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
          message: 'Validation failed',
        }),
      });
      getRegistry().bootstrap([passCheck, failCheck]);

      const runner = new AssessmentRunner({
        kubernetes: mockKubernetes,
        config: mockConfig,
        logger: mockLogger,
        storage: mockStorage as never,
      });

      const record = await runner.run({
        runId: 'run-partial-1',
        mode: AssessmentRunMode.Full,
      });

      expect(record.state).toBe('completed');
      expect(record.passed_checks).toBe(1);
      expect(record.failed_checks).toBe(1);
      expect(record.completed_checks).toBe(2);

      const passingResults = mockStorage.checkResults.filter(
        (r) => r.result.status === 'passing'
      );
      const failingResults = mockStorage.checkResults.filter(
        (r) => r.result.status === 'failing'
      );
      expect(passingResults).toHaveLength(1);
      expect(failingResults).toHaveLength(1);
    });
  });

  describe('run - timeout path', () => {
    it('records timeout without crashing runner', async () => {
      const slowCheck = createMockCheck({
        id: 'sec.slow',
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {
            checkId: 'sec.slow',
            pillar: Pillar.Security,
            status: CheckStatus.Passing,
            message: 'Done',
          };
        },
      });
      getRegistry().bootstrap([slowCheck]);

      const runner = new AssessmentRunner({
        kubernetes: mockKubernetes,
        config: mockConfig,
        logger: mockLogger,
        storage: mockStorage as never,
      });

      const record = await runner.run({
        runId: 'run-timeout-1',
        mode: AssessmentRunMode.Full,
        timeoutMs: 50,
      });

      expect(record.timeout_checks).toBe(1);
      expect(record.completed_checks).toBe(1);
      expect(mockStorage.checkResults[0].result.status).toBe('timeout');
      expect(mockStorage.checkResults[0].result.error_code).toBe('CHECK_TIMEOUT');
    });
  });

  describe('run - hard failure path', () => {
    it('records check error without crashing runner', async () => {
      const throwCheck = createMockCheck({
        id: 'sec.throw',
        run: async () => {
          throw new Error('Unexpected cluster error');
        },
      });
      getRegistry().bootstrap([throwCheck]);

      const runner = new AssessmentRunner({
        kubernetes: mockKubernetes,
        config: mockConfig,
        logger: mockLogger,
        storage: mockStorage as never,
      });

      const record = await runner.run({
        runId: 'run-error-1',
        mode: AssessmentRunMode.Full,
      });

      expect(record.error_checks).toBe(1);
      expect(record.completed_checks).toBe(1);
      expect(mockStorage.checkResults[0].result.status).toBe('error');
      expect(mockStorage.checkResults[0].result.message).toContain('Unexpected cluster error');
    });
  });

  describe('run - final summary', () => {
    it('includes counts and score in final record', async () => {
      const checks = [
        createMockCheck({
          id: 'a',
          run: async () => ({
            checkId: 'a',
            pillar: Pillar.Security,
            status: CheckStatus.Passing,
            message: 'ok',
          }),
        }),
        createMockCheck({
          id: 'b',
          run: async () => ({
            checkId: 'b',
            pillar: Pillar.Security,
            status: CheckStatus.Warning,
            message: 'warning',
          }),
        }),
      ];
      getRegistry().bootstrap(checks);

      const runner = new AssessmentRunner({
        kubernetes: mockKubernetes,
        config: mockConfig,
        logger: mockLogger,
        storage: mockStorage as never,
      });

      const record = await runner.run({
        runId: 'run-summary-1',
        mode: AssessmentRunMode.Full,
      });

      expect(record.total_checks).toBe(2);
      expect(record.completed_checks).toBe(2);
      expect(record.passed_checks).toBe(1);
      expect(record.warning_checks).toBe(1);
      expect(record.failed_checks).toBe(0);
      expect(record.started_at).toBeDefined();
      expect(record.completed_at).toBeDefined();
    });
  });

  describe('run - empty registry', () => {
    it('completes run with zero checks', async () => {
      const runner = new AssessmentRunner({
        kubernetes: mockKubernetes,
        config: mockConfig,
        logger: mockLogger,
        storage: mockStorage as never,
      });

      const record = await runner.run({
        runId: 'run-empty-1',
        mode: AssessmentRunMode.Full,
      });

      expect(record.total_checks).toBe(0);
      expect(record.completed_checks).toBe(0);
      expect(record.state).toBe('completed');
    });
  });
});
