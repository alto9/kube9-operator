/**
 * Integration tests for AssessmentRunner - end-to-end execution with SQLite.
 * Run with: npm run test:integration -- src/assessment/runner.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/manager.js';
import { SchemaManager } from '../database/schema.js';
import { AssessmentRepository } from '../database/assessment-repository.js';
import { AssessmentRunner, resolveChecksForRun } from './runner.js';
import { getRegistry, resetRegistry } from './registry.js';
import { bootstrapAssessmentRegistry } from './bootstrap.js';
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

const mockKubernetes = {
  coreApi: {
    listNode: async () => ({ items: [] }),
    listPodForAllNamespaces: async () => ({ items: [] }),
    listConfigMapForAllNamespaces: async () => ({ items: [] }),
    listResourceQuotaForAllNamespaces: async () => ({ items: [] }),
    listLimitRangeForAllNamespaces: async () => ({ items: [] }),
    listNamespace: async () => ({ items: [] }),
  },
  appsApi: {
    listDeploymentForAllNamespaces: async () => ({ items: [] }),
    listStatefulSetForAllNamespaces: async () => ({ items: [] }),
    listDaemonSetForAllNamespaces: async () => ({ items: [] }),
  },
  autoscalingApi: {
    listHorizontalPodAutoscalerForAllNamespaces: async () => ({ items: [] }),
  },
  policyApi: {
    listPodDisruptionBudgetForAllNamespaces: async () => ({ items: [] }),
  },
  apiextensionsApi: {
    readCustomResourceDefinition: async () => ({
      metadata: { name: 'externalsecrets.external-secrets.io' },
    }),
    listCustomResourceDefinition: async () => ({ body: { items: [] }, items: [] }),
  },
  customObjectsApi: {
    listClusterCustomObject: async () => ({ body: { items: [] }, items: [] }),
  },
  rbacApi: {
    listClusterRole: async () => ({ items: [] }),
    listRoleForAllNamespaces: async () => ({ items: [] }),
    listClusterRoleBinding: async () => ({ items: [] }),
    listRoleBindingForAllNamespaces: async () => ({ items: [] }),
  },
} as never;
const mockConfig = {
  serverUrl: 'https://test',
  logLevel: 'info',
  statusUpdateIntervalSeconds: 60,
  reregistrationIntervalHours: 24,
  clusterMetadataIntervalSeconds: 86400,
  resourceInventoryIntervalSeconds: 21600,
  resourceConfigurationPatternsIntervalSeconds: 43200,
  workloadImageScanIntervalSeconds: 86400,
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

  it('security pillar checks are discoverable and runnable via resolveChecksForRun', async () => {
    resetRegistry();
    bootstrapAssessmentRegistry();

    const checks = resolveChecksForRun({
      mode: AssessmentRunMode.Pillar,
      pillarFilter: Pillar.Security,
    });

    expect(checks.length).toBeGreaterThanOrEqual(9);
    const ids = checks.map((c) => c.id).sort();
    expect(ids).toContain('security.run-as-non-root');
    expect(ids).toContain('security.privileged-containers');
    expect(ids).toContain('security.capabilities-validation');
    expect(ids).toContain('security.rbac-wildcard-permissions');
    expect(ids).toContain('security.rbac-cluster-admin-misuse');
    expect(ids).toContain('security.secrets-in-configmaps');
    expect(ids).toContain('security.external-secrets-usage');
    expect(ids).toContain('security.hardcoded-secrets');
    expect(ids).toContain('security.stored-vulnerability-thresholds');
  });

  it('security checks run successfully with empty cluster (all pass)', async () => {
    resetRegistry();
    bootstrapAssessmentRegistry();

    const storage = new AssessmentRepository();
    const runner = new AssessmentRunner({
      kubernetes: mockKubernetes,
      config: mockConfig,
      logger: mockLogger,
      storage,
    });

    const record = await runner.run({
      runId: 'run-security-pillar',
      mode: AssessmentRunMode.Pillar,
      pillarFilter: Pillar.Security,
    });

    expect(record.run_id).toBe('run-security-pillar');
    expect(record.state).toBe('completed');
    expect(record.total_checks).toBe(9);
    expect(record.passed_checks).toBe(9);
    expect(record.failed_checks).toBe(0);

    const history = storage.queryHistory({ filters: { run_id: 'run-security-pillar' } });
    expect(history).toHaveLength(9);
    expect(history.every((h) => h.status === 'passing')).toBe(true);
  });

  it('performance-efficiency pillar checks are discoverable and runnable', async () => {
    resetRegistry();
    bootstrapAssessmentRegistry();

    const checks = resolveChecksForRun({
      mode: AssessmentRunMode.Pillar,
      pillarFilter: Pillar.PerformanceEfficiency,
    });

    expect(checks.length).toBe(4);
    const ids = checks.map((c) => c.id).sort();
    expect(ids).toEqual([
      'performance-efficiency.hpa-configuration-sanity',
      'performance-efficiency.namespace-resource-governance',
      'performance-efficiency.node-affinity-and-placement',
      'performance-efficiency.vpa-configuration-sanity',
    ]);

    const storage = new AssessmentRepository();
    const runner = new AssessmentRunner({
      kubernetes: mockKubernetes,
      config: mockConfig,
      logger: mockLogger,
      storage,
    });

    const record = await runner.run({
      runId: 'run-perf-pillar',
      mode: AssessmentRunMode.Pillar,
      pillarFilter: Pillar.PerformanceEfficiency,
    });

    expect(record.run_id).toBe('run-perf-pillar');
    expect(record.total_checks).toBe(4);
    expect(record.completed_checks).toBe(4);
    expect(record.failed_checks).toBe(0);

    const history = storage.queryHistory({ filters: { run_id: 'run-perf-pillar' } });
    expect(history).toHaveLength(4);
    expect(history.map((h) => h.check_id).sort()).toEqual(ids);
  });

  it('cost-optimization pillar check is discoverable and runnable', async () => {
    resetRegistry();
    bootstrapAssessmentRegistry();

    const checks = resolveChecksForRun({
      mode: AssessmentRunMode.Pillar,
      pillarFilter: Pillar.CostOptimization,
    });

    expect(checks.length).toBe(2);
    expect(checks.map((c) => c.id).sort()).toEqual([
      'cost-optimization.over-provisioning-detection',
      'cost-optimization.resource-request-limit-ratios',
    ]);

    const storage = new AssessmentRepository();
    const runner = new AssessmentRunner({
      kubernetes: mockKubernetes,
      config: mockConfig,
      logger: mockLogger,
      storage,
    });

    const record = await runner.run({
      runId: 'run-cost-pillar',
      mode: AssessmentRunMode.Pillar,
      pillarFilter: Pillar.CostOptimization,
    });

    expect(record.run_id).toBe('run-cost-pillar');
    expect(record.total_checks).toBe(2);
    expect(record.completed_checks).toBe(2);
    expect(record.passed_checks).toBe(2);

    const history = storage.queryHistory({ filters: { run_id: 'run-cost-pillar' } });
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.check_id).sort()).toEqual([
      'cost-optimization.over-provisioning-detection',
      'cost-optimization.resource-request-limit-ratios',
    ]);
  });
});
