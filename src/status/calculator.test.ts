import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RegistrationState, CollectionStats, ArgoCDStatus } from './types.js';

describe('calculateStatus', () => {
  let originalPodNamespace: string | undefined;

  beforeEach(() => {
    // Save original POD_NAMESPACE
    originalPodNamespace = process.env.POD_NAMESPACE;
  });

  afterEach(() => {
    // Restore POD_NAMESPACE
    if (originalPodNamespace !== undefined) {
      process.env.POD_NAMESPACE = originalPodNamespace;
    } else {
      delete process.env.POD_NAMESPACE;
    }
    
    // Restore mocks and reset modules
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('basic status calculation', () => {
    it('should return status with all required fields including namespace', async () => {
      delete process.env.POD_NAMESPACE;
      
      // Reset modules and set up mocks
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus();

      expect(status).toMatchObject({
        mode: 'operated',
        tier: 'free',
        version: '1.0.0',
        health: 'healthy',
        registered: false,
        apiKeyConfigured: false,
        error: null,
        namespace: 'kube9-system',
      });
      
      // Verify all required fields are present
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
    });

    it('should return enabled mode when API key is present', async () => {
      delete process.env.POD_NAMESPACE;
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: 'kdy_prod_test123',
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus();

      expect(status.mode).toBe('enabled');
      expect(status.namespace).toBe('kube9-system');
    });

    it('should return pro tier when API key present and registered', async () => {
      delete process.env.POD_NAMESPACE;
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: 'kdy_prod_test123',
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const registrationState: RegistrationState = {
        isRegistered: true,
        clusterId: 'cls_test123',
        consecutiveFailures: 0,
      };

      const status = calculatorModule.calculateStatus(registrationState);

      expect(status.tier).toBe('pro');
      expect(status.registered).toBe(true);
      expect(status.clusterId).toBe('cls_test123');
      expect(status.namespace).toBe('kube9-system');
    });
  });

  describe('namespace field', () => {
    it('should use POD_NAMESPACE environment variable when set', async () => {
      process.env.POD_NAMESPACE = 'custom-namespace';
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus();

      expect(status.namespace).toBe('custom-namespace');
    });

    it('should fallback to kube9-system when POD_NAMESPACE not set', async () => {
      delete process.env.POD_NAMESPACE;
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus();

      expect(status.namespace).toBe('kube9-system');
    });

    it('should use POD_NAMESPACE in all status scenarios', async () => {
      process.env.POD_NAMESPACE = 'test-namespace';
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: 'kdy_prod_test123',
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');

      // Test with different registration states
      const unregisteredStatus = calculatorModule.calculateStatus({
        isRegistered: false,
        consecutiveFailures: 0,
      });
      expect(unregisteredStatus.namespace).toBe('test-namespace');

      const registeredStatus = calculatorModule.calculateStatus({
        isRegistered: true,
        clusterId: 'cls_test123',
        consecutiveFailures: 0,
      });
      expect(registeredStatus.namespace).toBe('test-namespace');

      // Test with errors
      const errorStatus = calculatorModule.calculateStatus(
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
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus(
        { isRegistered: false, consecutiveFailures: 0 },
        null,
        false // cannot write ConfigMap
      );

      expect(status.health).toBe('unhealthy');
      expect(status.error).toBe('Failed to write status ConfigMap: check RBAC permissions');
      expect(status.namespace).toBe('kube9-system');
    });

    it('should return degraded when API key present but not registered', async () => {
      delete process.env.POD_NAMESPACE;
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: 'kdy_prod_test123',
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus({
        isRegistered: false,
        consecutiveFailures: 0,
      });

      expect(status.health).toBe('degraded');
      expect(status.error).toBe('API key configured but not registered with kube9-server');
      expect(status.namespace).toBe('kube9-system');
    });

    it('should return degraded when consecutive failures exceed threshold', async () => {
      delete process.env.POD_NAMESPACE;
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null, // No API key, so consecutive failures error takes precedence
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus({
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
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const collectionStats: CollectionStats = {
        totalSuccessCount: 10,
        totalFailureCount: 2,
        collectionsStoredCount: 8,
        lastSuccessTime: '2025-01-01T00:00:00Z',
      };

      const status = calculatorModule.calculateStatus(
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
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const argocdStatus: ArgoCDStatus = {
        detected: true,
        namespace: 'argocd',
        version: 'v2.8.0',
        lastChecked: '2025-01-01T00:00:00Z',
      };

      const status = calculatorModule.calculateStatus(
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

  describe('error handling', () => {
    it('should include namespace even when error is present', async () => {
      process.env.POD_NAMESPACE = 'error-namespace';
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const status = calculatorModule.calculateStatus(
        { isRegistered: false, consecutiveFailures: 0 },
        'Test error message',
        false // cannot write ConfigMap
      );

      expect(status.error).toBe('Test error message');
      expect(status.namespace).toBe('error-namespace');
      expect(status.health).toBe('unhealthy');
    });

    it('should truncate long error messages but preserve namespace', async () => {
      delete process.env.POD_NAMESPACE;
      
      vi.resetModules();
      const configLoader = await import('../config/loader.js');
      vi.spyOn(configLoader, 'getConfig').mockReturnValue({
        apiKey: null,
        serverUrl: 'https://api.kube9.dev',
        logLevel: 'info',
        statusUpdateIntervalSeconds: 60,
        reregistrationIntervalHours: 24,
        clusterMetadataIntervalSeconds: 86400,
        resourceInventoryIntervalSeconds: 21600,
        resourceConfigurationPatternsIntervalSeconds: 43200,
      } as any);

      const calculatorModule = await import('./calculator.js');
      const longError = 'a'.repeat(600);
      const status = calculatorModule.calculateStatus(
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

