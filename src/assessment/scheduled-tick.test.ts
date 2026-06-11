import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { AssessmentRunner } from './runner.js';
import { getRegistry, resetRegistry } from './registry.js';
import {
  ensureAssessmentRegistryBootstrapped,
  runScheduledAssessmentTick,
  getScheduledAssessmentLastRunSnapshot,
  resetScheduledAssessmentStateForTests,
} from './scheduled-tick.js';
import type { Config } from '../config/types.js';
import type { Logger } from 'winston';
import { DatabaseManager } from '../database/manager.js';
import { SchemaManager } from '../database/schema.js';

const baseConfig = {
  logLevel: 'info',
  statusUpdateIntervalSeconds: 60,
  clusterMetadataIntervalSeconds: 86400,
  resourceInventoryIntervalSeconds: 21600,
  resourceConfigurationPatternsIntervalSeconds: 43200,
  workloadImageScanIntervalSeconds: 86400,
  argocdApplicationStatusIntervalSeconds: 3600,
  eventRetentionInfoWarningDays: 7,
  eventRetentionErrorCriticalDays: 30,
  assessmentEnabled: true,
  assessmentIntervalSeconds: 86400,
  assessmentMode: 'full' as const,
  aiConformanceEnabled: false,
  aiConformanceIntervalSeconds: 86400,
  aiConformanceChecklistSource: 'bundled' as const,
} satisfies Config;

const mockKubernetes = {
  coreApi: {
    listNode: async () => ({ items: [] }),
    listPodForAllNamespaces: async () => ({ items: [] }),
  },
} as never;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const testDbDir = path.join(process.cwd(), 'test-scheduled-tick-temp');

describe('scheduled assessment tick', () => {
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
    resetScheduledAssessmentStateForTests();
    DatabaseManager.reset();
    new SchemaManager().initialize();
    vi.restoreAllMocks();
    vi.mocked(mockLogger.error).mockClear();
    vi.mocked(mockLogger.info).mockClear();
    vi.mocked(mockLogger.warn).mockClear();
    vi.mocked(mockLogger.debug).mockClear();
  });

  afterEach(() => {
    resetRegistry();
    resetScheduledAssessmentStateForTests();
  });

  it('ensureAssessmentRegistryBootstrapped registers once and is stable on repeat', () => {
    expect(getRegistry().size).toBe(0);
    ensureAssessmentRegistryBootstrapped();
    const afterFirst = getRegistry().size;
    expect(afterFirst).toBeGreaterThan(0);
    ensureAssessmentRegistryBootstrapped();
    expect(getRegistry().size).toBe(afterFirst);
  });

  it('runScheduledAssessmentTick records failed snapshot when runner.run throws', async () => {
    ensureAssessmentRegistryBootstrapped();
    vi.spyOn(AssessmentRunner.prototype, 'run').mockRejectedValue(new Error('simulated runner failure'));

    await runScheduledAssessmentTick({
      kubernetes: mockKubernetes,
      config: baseConfig,
      logger: mockLogger,
    });

    const snap = getScheduledAssessmentLastRunSnapshot();
    expect(snap?.outcome).toBe('failed');
    expect(snap?.errorMessage).toContain('simulated runner failure');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('runScheduledAssessmentTick records success snapshot when runner completes', async () => {
    ensureAssessmentRegistryBootstrapped();
    vi.spyOn(AssessmentRunner.prototype, 'run').mockResolvedValue({
      run_id: 'scheduled-test-run',
      mode: 'full',
      state: 'completed',
      requested_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      total_checks: 3,
      completed_checks: 3,
      passed_checks: 2,
      failed_checks: 0,
      warning_checks: 1,
      skipped_checks: 0,
      error_checks: 0,
      timeout_checks: 0,
    } as Awaited<ReturnType<AssessmentRunner['run']>>);

    await runScheduledAssessmentTick({
      kubernetes: mockKubernetes,
      config: baseConfig,
      logger: mockLogger,
    });

    const snap = getScheduledAssessmentLastRunSnapshot();
    expect(snap?.outcome).toBe('success');
    expect(snap?.runId).toBe('scheduled-test-run');
    expect(snap?.passedChecks).toBe(2);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
