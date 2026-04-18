import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  CollectionStats,
  ArgoCDStatus,
  TrivyStatus,
  AssessmentStatusSummary,
} from './types.js';
import { DEFAULT_ASSESSMENT_STATUS_SUMMARY, buildAssessmentStatusSummary } from './assessment-summary.js';

describe('calculateStatus', () => {
  let originalPodNamespace: string | undefined;

  beforeEach(() => {
    originalPodNamespace = process.env.POD_NAMESPACE;
  });

  afterEach(() => {
    if (originalPodNamespace !== undefined) {
      process.env.POD_NAMESPACE = originalPodNamespace;
    } else {
      delete process.env.POD_NAMESPACE;
    }

    vi.resetModules();
  });

  describe('basic status calculation', () => {
    it('should return status with all required fields including namespace', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus();

      expect(status).toMatchObject({
        mode: 'operated',
        tier: 'free',
        version: '1.0.0',
        health: 'healthy',
        error: null,
        namespace: 'kube9-system',
      });

      expect(status.mode).toBe('operated');
      expect(status.tier).toBe('free');
      expect(status.version).toBe('1.0.0');
      expect(status.health).toBe('healthy');
      expect(status.error).toBe(null);
      expect(status.namespace).toBe('kube9-system');
      expect(status.lastUpdate).toBeDefined();
      expect(status.collectionStats).toBeDefined();
      expect(status.argocd).toBeDefined();
      expect(status.trivy).toBeDefined();
      expect(status.assessment).toEqual({
        ...DEFAULT_ASSESSMENT_STATUS_SUMMARY,
        lastScheduledTotals: { ...DEFAULT_ASSESSMENT_STATUS_SUMMARY.lastScheduledTotals },
      });
    });
  });

  describe('namespace field', () => {
    it('should use POD_NAMESPACE environment variable when set', async () => {
      process.env.POD_NAMESPACE = 'custom-namespace';

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus();

      expect(status.namespace).toBe('custom-namespace');
    });

    it('should fallback to kube9-system when POD_NAMESPACE not set', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus();

      expect(status.namespace).toBe('kube9-system');
    });

    it('should use POD_NAMESPACE in status scenarios with errors', async () => {
      process.env.POD_NAMESPACE = 'test-namespace';

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');

      const okStatus = calculateStatus();
      expect(okStatus.namespace).toBe('test-namespace');

      const errorStatus = calculateStatus('Test error', true);
      expect(errorStatus.namespace).toBe('test-namespace');
    });
  });

  describe('health calculation', () => {
    it('should return unhealthy when cannot write ConfigMap', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus(null, false);

      expect(status.health).toBe('unhealthy');
      expect(status.error).toBe('Failed to write status ConfigMap: check RBAC permissions');
      expect(status.namespace).toBe('kube9-system');
    });

    it('should return healthy when there are no write failures', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus();

      expect(status.health).toBe('healthy');
      expect(status.error).toBe(null);
      expect(status.namespace).toBe('kube9-system');
    });
  });

  describe('collection stats', () => {
    it('should include collection stats in status', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const collectionStats: CollectionStats = {
        totalSuccessCount: 10,
        totalFailureCount: 2,
        collectionsStoredCount: 8,
        lastSuccessTime: '2025-01-01T00:00:00Z',
      };

      const status = calculateStatus(null, true, collectionStats);

      expect(status.collectionStats).toEqual(collectionStats);
      expect(status.namespace).toBe('kube9-system');
    });
  });

  describe('argocd status', () => {
    it('should include ArgoCD status in operator status', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const argocdStatus: ArgoCDStatus = {
        detected: true,
        namespace: 'argocd',
        version: 'v2.8.0',
        lastChecked: '2025-01-01T00:00:00Z',
      };

      const status = calculateStatus(
        null,
        true,
        {
          totalSuccessCount: 0,
          totalFailureCount: 0,
          collectionsStoredCount: 0,
          lastSuccessTime: null,
        },
        argocdStatus
      );

      expect(status.argocd).toEqual(argocdStatus);
      expect(status.namespace).toBe('kube9-system');
    });
  });

  describe('assessment summary', () => {
    it('should use stable defaults when no assessment run has occurred', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus();

      expect(status.assessment.lastScheduledOutcome).toBe('none');
      expect(status.assessment.lastScheduledCompletedAt).toBe(null);
      expect(status.assessment.lastScheduledRunState).toBe(null);
      expect(status.assessment.lastScheduledRunId).toBe(null);
      expect(status.assessment.lastScheduledError).toBe(null);
      expect(status.assessment.lastScheduledTotals).toEqual({
        totalChecks: 0,
        completedChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warningChecks: 0,
      });
    });

    it('should include provided assessment summary in status', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const summary: AssessmentStatusSummary = {
        lastScheduledCompletedAt: '2025-06-01T12:00:00Z',
        lastScheduledOutcome: 'success',
        lastScheduledRunState: 'completed',
        lastScheduledRunId: 'run-1',
        lastScheduledTotals: {
          totalChecks: 10,
          completedChecks: 10,
          passedChecks: 8,
          failedChecks: 1,
          warningChecks: 1,
        },
        lastScheduledError: null,
      };

      const status = calculateStatus(
        null,
        true,
        {
          totalSuccessCount: 0,
          totalFailureCount: 0,
          collectionsStoredCount: 0,
          lastSuccessTime: null,
        },
        {
          detected: false,
          namespace: null,
          version: null,
          lastChecked: '2025-01-01T00:00:00Z',
        },
        {
          detected: false,
          serverUrl: null,
          version: null,
          lastChecked: '2025-01-01T00:00:00Z',
        },
        summary
      );

      expect(status.assessment).toEqual({
        ...summary,
        lastScheduledTotals: { ...summary.lastScheduledTotals },
      });
    });

    it('should map scheduled snapshot via buildAssessmentStatusSummary', () => {
      const fromSuccess = buildAssessmentStatusSummary({
        startedAt: '2025-06-01T11:00:00Z',
        completedAt: '2025-06-01T12:00:00Z',
        outcome: 'success',
        runId: 'abc',
        state: 'completed',
        totalChecks: 5,
        completedChecks: 5,
        passedChecks: 4,
        failedChecks: 0,
        warningChecks: 1,
      });
      expect(fromSuccess.lastScheduledOutcome).toBe('success');
      expect(fromSuccess.lastScheduledRunId).toBe('abc');
      expect(fromSuccess.lastScheduledTotals.passedChecks).toBe(4);

      const fromFail = buildAssessmentStatusSummary({
        startedAt: '2025-06-01T11:00:00Z',
        completedAt: '2025-06-01T12:00:01Z',
        outcome: 'failed',
        errorMessage: 'boom',
      });
      expect(fromFail.lastScheduledOutcome).toBe('failed');
      expect(fromFail.lastScheduledError).toBe('boom');
      expect(fromFail.lastScheduledTotals.totalChecks).toBe(0);
    });
  });

  describe('trivy status', () => {
    it('should include Trivy status in operator status', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const trivyStatus: TrivyStatus = {
        detected: true,
        serverUrl: 'http://trivy:4954',
        version: '0.58.0',
        lastChecked: '2025-01-01T00:00:00Z',
      };

      const status = calculateStatus(
        null,
        true,
        {
          totalSuccessCount: 0,
          totalFailureCount: 0,
          collectionsStoredCount: 0,
          lastSuccessTime: null,
        },
        {
          detected: false,
          namespace: null,
          version: null,
          lastChecked: '2025-01-01T00:00:00Z',
        },
        trivyStatus
      );

      expect(status.trivy).toEqual(trivyStatus);
    });
  });

  describe('error handling', () => {
    it('should include namespace even when error is present', async () => {
      process.env.POD_NAMESPACE = 'error-namespace';

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus('Test error message', false);

      expect(status.error).toBe('Test error message');
      expect(status.namespace).toBe('error-namespace');
      expect(status.health).toBe('unhealthy');
    });

    it('should truncate long error messages but preserve namespace', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const longError = 'a'.repeat(600);
      const status = calculateStatus(longError, false);

      expect(status.error).toBeTruthy();
      expect(status.error!.length).toBeLessThanOrEqual(500);
      expect(status.error!.endsWith('...')).toBe(true);
      expect(status.namespace).toBe('kube9-system');
    });
  });
});
