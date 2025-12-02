import { describe, it, expect } from 'vitest';
import { LocalStorage } from './storage.js';
import type { 
  CollectionPayload, 
  ClusterMetadata, 
  ResourceInventory, 
  ResourceConfigurationPatternsData 
} from './types.js';

/**
 * Helper function to create a cluster metadata collection payload
 */
function createClusterMetadataPayload(collectionId: string): CollectionPayload {
  const data: ClusterMetadata = {
    timestamp: new Date().toISOString(),
    collectionId,
    clusterId: 'cls_test123',
    kubernetesVersion: '1.28.0',
    nodeCount: 3,
    provider: 'aws',
    region: 'us-east-1',
    zone: 'us-east-1a',
  };

  return {
    version: 'v1.0.0',
    type: 'cluster-metadata',
    data,
    sanitization: {
      rulesApplied: ['hash-identifiers'],
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Helper function to create a resource inventory collection payload
 */
function createResourceInventoryPayload(collectionId: string): CollectionPayload {
  const data: ResourceInventory = {
    timestamp: new Date().toISOString(),
    collectionId,
    clusterId: 'cls_test123',
    namespaces: {
      count: 2,
      list: ['namespace-abc123', 'namespace-def456'],
    },
    resources: {
      pods: {
        total: 10,
        byNamespace: {
          'namespace-abc123': 5,
          'namespace-def456': 5,
        },
      },
      deployments: { total: 3 },
      statefulSets: { total: 1 },
      replicaSets: { total: 5 },
      services: {
        total: 4,
        byType: {
          ClusterIP: 3,
          LoadBalancer: 1,
        },
      },
    },
  };

  return {
    version: 'v1.0.0',
    type: 'resource-inventory',
    data,
    sanitization: {
      rulesApplied: ['hash-namespace-names'],
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Helper function to create a resource configuration patterns collection payload
 */
function createResourceConfigurationPatternsPayload(collectionId: string): CollectionPayload {
  const data: ResourceConfigurationPatternsData = {
    timestamp: new Date().toISOString(),
    collectionId,
    clusterId: 'cls_test123',
    resourceLimitsRequests: {
      containers: {
        cpuRequests: ['100m', '200m', null],
        cpuLimits: ['1000m', '2000m', null],
        memoryRequests: ['128Mi', '256Mi', null],
        memoryLimits: ['512Mi', '1Gi', null],
        totalCount: 3,
      },
    },
    replicaCounts: {
      deployments: [1, 2, 3],
      statefulSets: [1],
      daemonSetCount: 2,
    },
    imagePullPolicies: {
      policies: {
        Always: 5,
        IfNotPresent: 10,
        Never: 0,
        notSet: 2,
      },
      totalContainers: 17,
    },
    securityContexts: {
      podLevel: {
        runAsNonRoot: { true: 5, false: 2, notSet: 3 },
        fsGroup: { set: 4, notSet: 6 },
      },
      containerLevel: {
        runAsNonRoot: { true: 8, false: 3, notSet: 6 },
        readOnlyRootFilesystem: { true: 5, false: 7, notSet: 5 },
        allowPrivilegeEscalation: { true: 2, false: 10, notSet: 5 },
        capabilities: {
          added: ['NET_ADMIN', 'SYS_TIME'],
          dropped: ['ALL'],
        },
      },
      totalPods: 10,
      totalContainers: 17,
    },
    labelsAnnotations: {
      labelCounts: {
        pods: [3, 4, 5],
        deployments: [2, 3],
        services: [2, 2, 3],
      },
      annotationCounts: {
        pods: [1, 2, 3],
        deployments: [1, 2],
        services: [0, 1, 2],
      },
      commonLabelKeys: ['app', 'version', 'component'],
    },
    volumes: {
      volumeTypes: {
        configMap: 5,
        secret: 3,
        emptyDir: 2,
        persistentVolumeClaim: 1,
        hostPath: 0,
        downwardAPI: 1,
        projected: 0,
        other: 0,
      },
      volumesPerPod: [1, 2, 3, 0],
      volumeMountsPerContainer: [1, 1, 2, 3],
      totalPods: 4,
    },
    services: {
      serviceTypes: {
        ClusterIP: 5,
        NodePort: 2,
        LoadBalancer: 1,
        ExternalName: 0,
      },
      portsPerService: [1, 2, 3],
      totalServices: 8,
    },
    probes: {
      livenessProbes: {
        configured: 10,
        notConfigured: 7,
        probeTypes: { http: 8, tcp: 2, exec: 0, grpc: 0 },
        initialDelaySeconds: [10, 15, 20],
        timeoutSeconds: [5, 10],
        periodSeconds: [10, 15, 20],
      },
      readinessProbes: {
        configured: 12,
        notConfigured: 5,
        probeTypes: { http: 10, tcp: 2, exec: 0, grpc: 0 },
        initialDelaySeconds: [5, 10, 15],
        timeoutSeconds: [5, 10],
        periodSeconds: [10, 15],
      },
      startupProbes: {
        configured: 3,
        notConfigured: 14,
        probeTypes: { http: 2, tcp: 1, exec: 0, grpc: 0 },
        initialDelaySeconds: [30, 45],
        timeoutSeconds: [10],
        periodSeconds: [10, 15],
      },
      totalContainers: 17,
    },
  };

  return {
    version: 'v1.0.0',
    type: 'resource-configuration-patterns',
    data,
    sanitization: {
      rulesApplied: ['no-resource-names', 'aggregated-configuration-data'],
      timestamp: new Date().toISOString(),
    },
  };
}

describe('LocalStorage', () => {
  describe('constructor', () => {
    it('initializes with default max collections', () => {
      const storage = new LocalStorage();
      expect(storage.getSize()).toBe(0);
    });

    it('initializes with custom max collections', () => {
      const storage = new LocalStorage(50);
      expect(storage.getSize()).toBe(0);
    });

    it('throws error for invalid max collections', () => {
      expect(() => new LocalStorage(0)).toThrow(/maxCollections must be at least 1/);
      expect(() => new LocalStorage(-5)).toThrow(/maxCollections must be at least 1/);
    });
  });

  describe('store()', () => {
    it('stores cluster metadata collection', async () => {
      const storage = new LocalStorage();
      const payload = createClusterMetadataPayload('coll_cluster001');

      await storage.store(payload);

      expect(storage.getSize()).toBe(1);
    });

    it('stores resource inventory collection', async () => {
      const storage = new LocalStorage();
      const payload = createResourceInventoryPayload('coll_inventory001');

      await storage.store(payload);

      expect(storage.getSize()).toBe(1);
    });

    it('stores resource configuration patterns collection', async () => {
      const storage = new LocalStorage();
      const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

      await storage.store(payload);

      expect(storage.getSize()).toBe(1);
    });

    it('handles multiple collection types', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_cluster001'));
      await storage.store(createResourceInventoryPayload('coll_inventory001'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

      expect(storage.getSize()).toBe(3);
    });

    it('enforces size limit by removing oldest', async () => {
      const storage = new LocalStorage(3);
      
      await storage.store(createClusterMetadataPayload('coll_001'));
      await storage.store(createResourceInventoryPayload('coll_002'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_003'));
      
      expect(storage.getSize()).toBe(3);

      await storage.store(createClusterMetadataPayload('coll_004'));
      
      expect(storage.getSize()).toBe(3);

      const oldest = await storage.retrieve('coll_001');
      expect(oldest).toBe(null);

      const newest = await storage.retrieve('coll_004');
      expect(newest).toBeTruthy();
    });

    it('updates existing collection and moves to front', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_001'));
      await storage.store(createResourceInventoryPayload('coll_002'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_003'));

      await storage.store(createClusterMetadataPayload('coll_001'));

      const recent = await storage.listRecent(3);
      
      expect(recent.length).toBe(3);
      expect((recent[0].data as ClusterMetadata).collectionId).toBe('coll_001');
    });
  });

  describe('retrieve()', () => {
    it('returns stored collection', async () => {
      const storage = new LocalStorage();
      const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

      await storage.store(payload);
      const retrieved = await storage.retrieve('coll_patterns001');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.type).toBe('resource-configuration-patterns');
      expect((retrieved?.data as ResourceConfigurationPatternsData).collectionId).toBe('coll_patterns001');
    });

    it('returns null for non-existent collection', async () => {
      const storage = new LocalStorage();
      const retrieved = await storage.retrieve('coll_nonexistent');

      expect(retrieved).toBe(null);
    });

    it('returns correct collection by ID', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_cluster001'));
      await storage.store(createResourceInventoryPayload('coll_inventory001'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

      const retrieved = await storage.retrieve('coll_inventory001');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.type).toBe('resource-inventory');
      expect((retrieved?.data as ResourceInventory).collectionId).toBe('coll_inventory001');
    });
  });

  describe('listRecent()', () => {
    it('returns collections in most recent first order', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_cluster001'));
      await storage.store(createResourceInventoryPayload('coll_inventory001'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

      const recent = await storage.listRecent(3);

      expect(recent.length).toBe(3);
      expect(recent[0].type).toBe('resource-configuration-patterns');
      expect(recent[1].type).toBe('resource-inventory');
      expect(recent[2].type).toBe('cluster-metadata');
    });

    it('respects limit parameter', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_cluster001'));
      await storage.store(createResourceInventoryPayload('coll_inventory001'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

      const recent = await storage.listRecent(2);

      expect(recent.length).toBe(2);
      expect(recent[0].type).toBe('resource-configuration-patterns');
      expect(recent[1].type).toBe('resource-inventory');
    });

    it('returns empty array when no collections', async () => {
      const storage = new LocalStorage();
      const recent = await storage.listRecent(10);

      expect(recent.length).toBe(0);
    });

    it('throws error for negative limit', async () => {
      const storage = new LocalStorage();
      
      await expect(async () => storage.listRecent(-1)).rejects.toThrow(/limit must be non-negative/);
    });
  });

  describe('clear()', () => {
    it('removes all collections', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_cluster001'));
      await storage.store(createResourceInventoryPayload('coll_inventory001'));
      await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

      expect(storage.getSize()).toBe(3);

      await storage.clear();

      expect(storage.getSize()).toBe(0);
    });

    it('allows new collections after clearing', async () => {
      const storage = new LocalStorage();
      
      await storage.store(createClusterMetadataPayload('coll_001'));
      await storage.clear();
      await storage.store(createResourceConfigurationPatternsPayload('coll_002'));

      expect(storage.getSize()).toBe(1);
      
      const retrieved = await storage.retrieve('coll_002');
      expect(retrieved).toBeTruthy();
    });
  });

  describe('getSize()', () => {
    it('returns correct count', async () => {
      const storage = new LocalStorage();
      
      expect(storage.getSize()).toBe(0);
      
      await storage.store(createClusterMetadataPayload('coll_001'));
      expect(storage.getSize()).toBe(1);
      
      await storage.store(createResourceInventoryPayload('coll_002'));
      expect(storage.getSize()).toBe(2);
      
      await storage.store(createResourceConfigurationPatternsPayload('coll_003'));
      expect(storage.getSize()).toBe(3);
    });
  });

  describe('resource configuration patterns', () => {
    it('handles data structure correctly', async () => {
      const storage = new LocalStorage();
      const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

      await storage.store(payload);
      const retrieved = await storage.retrieve('coll_patterns001');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.type).toBe('resource-configuration-patterns');
      
      const data = retrieved?.data as ResourceConfigurationPatternsData;
      
      expect(data.timestamp).toBeTruthy();
      expect(data.collectionId).toBe('coll_patterns001');
      expect(data.clusterId).toBe('cls_test123');
      expect(data.resourceLimitsRequests).toBeTruthy();
      expect(data.replicaCounts).toBeTruthy();
      expect(data.imagePullPolicies).toBeTruthy();
      expect(data.securityContexts).toBeTruthy();
      expect(data.labelsAnnotations).toBeTruthy();
      expect(data.volumes).toBeTruthy();
      expect(data.services).toBeTruthy();
      expect(data.probes).toBeTruthy();
    });

    it('preserves complex nested structures', async () => {
      const storage = new LocalStorage();
      const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

      await storage.store(payload);
      const retrieved = await storage.retrieve('coll_patterns001');

      expect(retrieved).toBeTruthy();
      
      const originalData = payload.data as ResourceConfigurationPatternsData;
      const retrievedData = retrieved?.data as ResourceConfigurationPatternsData;
      
      expect(retrievedData.securityContexts.containerLevel.capabilities).toEqual(
        originalData.securityContexts.containerLevel.capabilities
      );
      
      expect(retrievedData.volumes.volumeTypes).toEqual(originalData.volumes.volumeTypes);
      
      expect(retrievedData.probes.livenessProbes.probeTypes).toEqual(
        originalData.probes.livenessProbes.probeTypes
      );
    });
  });
});
