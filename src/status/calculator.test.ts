import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RegistrationState, CollectionStats, ArgoCDStatus, TrivyStatus } from './types.js';

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
        registered: false,
        error: null,
        namespace: 'kube9-system',
      });

      expect(status.mode).toBe('operated');
      expect(status.tier).toBe('free');
      expect(status.version).toBe('1.0.0');
      expect(status.health).toBe('healthy');
      expect(status.registered).toBe(false);
      expect(status.error).toBe(null);
      expect(status.namespace).toBe('kube9-system');
      expect(status.lastUpdate).toBeDefined();
      expect(status.collectionStats).toBeDefined();
      expect(status.argocd).toBeDefined();
      expect(status.trivy).toBeDefined();
    });

    it('should return free tier when registered', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const registrationState: RegistrationState = {
        isRegistered: true,
        clusterId: 'cls_test123',
        consecutiveFailures: 0,
      };

      const status = calculateStatus(registrationState);

      expect(status.tier).toBe('free');
      expect(status.registered).toBe(true);
      expect(status.clusterId).toBe('cls_test123');
      expect(status.namespace).toBe('kube9-system');
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

    it('should use POD_NAMESPACE in all status scenarios', async () => {
      process.env.POD_NAMESPACE = 'test-namespace';

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');

      const unregisteredStatus = calculateStatus({
        isRegistered: false,
        consecutiveFailures: 0,
      });
      expect(unregisteredStatus.namespace).toBe('test-namespace');

      const registeredStatus = calculateStatus({
        isRegistered: true,
        clusterId: 'cls_test123',
        consecutiveFailures: 0,
      });
      expect(registeredStatus.namespace).toBe('test-namespace');

      const errorStatus = calculateStatus(
        {
          isRegistered: false,
          consecutiveFailures: 0,
        },
        'Test error'
      );
      expect(errorStatus.namespace).toBe('test-namespace');
    });
  });

  describe('health calculation', () => {
    it('should return unhealthy when cannot write ConfigMap', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus(
        { isRegistered: false, consecutiveFailures: 0 },
        null,
        false
      );

      expect(status.health).toBe('unhealthy');
      expect(status.error).toBe('Failed to write status ConfigMap: check RBAC permissions');
      expect(status.namespace).toBe('kube9-system');
    });

    it('should return healthy when there are no write or registration failures', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus({
        isRegistered: false,
        consecutiveFailures: 0,
      });

      expect(status.health).toBe('healthy');
      expect(status.error).toBe(null);
      expect(status.namespace).toBe('kube9-system');
    });

    it('should return degraded when consecutive failures exceed threshold', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const status = calculateStatus({
        isRegistered: false,
        consecutiveFailures: 5,
      });

      expect(status.health).toBe('degraded');
      expect(status.error).toBe('Registration failed 5 times consecutively');
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

      const status = calculateStatus(
        { isRegistered: false, consecutiveFailures: 0 },
        null,
        true,
        collectionStats
      );

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
        { isRegistered: false, consecutiveFailures: 0 },
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
        { isRegistered: false, consecutiveFailures: 0 },
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
      const status = calculateStatus(
        { isRegistered: false, consecutiveFailures: 0 },
        'Test error message',
        false
      );

      expect(status.error).toBe('Test error message');
      expect(status.namespace).toBe('error-namespace');
      expect(status.health).toBe('unhealthy');
    });

    it('should truncate long error messages but preserve namespace', async () => {
      delete process.env.POD_NAMESPACE;

      vi.resetModules();
      const { calculateStatus } = await import('./calculator.js');
      const longError = 'a'.repeat(600);
      const status = calculateStatus(
        { isRegistered: false, consecutiveFailures: 0 },
        longError,
        false
      );

      expect(status.error).toBeTruthy();
      expect(status.error!.length).toBeLessThanOrEqual(500);
      expect(status.error!.endsWith('...')).toBe(true);
      expect(status.namespace).toBe('kube9-system');
    });
  });
});
