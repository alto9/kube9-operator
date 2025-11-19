import { test } from 'node:test';
import * as assert from 'node:assert';
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

test('LocalStorage - constructor initializes with default max collections', () => {
  const storage = new LocalStorage();
  assert.strictEqual(storage.getSize(), 0, 'Should start with 0 collections');
});

test('LocalStorage - constructor initializes with custom max collections', () => {
  const storage = new LocalStorage(50);
  assert.strictEqual(storage.getSize(), 0, 'Should start with 0 collections');
});

test('LocalStorage - constructor throws error for invalid max collections', () => {
  assert.throws(
    () => new LocalStorage(0),
    /maxCollections must be at least 1/,
    'Should throw error for 0 max collections'
  );

  assert.throws(
    () => new LocalStorage(-5),
    /maxCollections must be at least 1/,
    'Should throw error for negative max collections'
  );
});

test('LocalStorage - store() stores cluster metadata collection', async () => {
  const storage = new LocalStorage();
  const payload = createClusterMetadataPayload('coll_cluster001');

  await storage.store(payload);

  assert.strictEqual(storage.getSize(), 1, 'Should have 1 collection');
});

test('LocalStorage - store() stores resource inventory collection', async () => {
  const storage = new LocalStorage();
  const payload = createResourceInventoryPayload('coll_inventory001');

  await storage.store(payload);

  assert.strictEqual(storage.getSize(), 1, 'Should have 1 collection');
});

test('LocalStorage - store() stores resource configuration patterns collection', async () => {
  const storage = new LocalStorage();
  const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

  await storage.store(payload);

  assert.strictEqual(storage.getSize(), 1, 'Should have 1 collection');
});

test('LocalStorage - store() handles multiple collection types', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_cluster001'));
  await storage.store(createResourceInventoryPayload('coll_inventory001'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

  assert.strictEqual(storage.getSize(), 3, 'Should have 3 collections');
});

test('LocalStorage - retrieve() returns stored collection', async () => {
  const storage = new LocalStorage();
  const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

  await storage.store(payload);
  const retrieved = await storage.retrieve('coll_patterns001');

  assert.ok(retrieved, 'Should retrieve collection');
  assert.strictEqual(retrieved?.type, 'resource-configuration-patterns', 'Should match collection type');
  assert.strictEqual(
    (retrieved?.data as ResourceConfigurationPatternsData).collectionId,
    'coll_patterns001',
    'Should match collection ID'
  );
});

test('LocalStorage - retrieve() returns null for non-existent collection', async () => {
  const storage = new LocalStorage();
  const retrieved = await storage.retrieve('coll_nonexistent');

  assert.strictEqual(retrieved, null, 'Should return null for non-existent collection');
});

test('LocalStorage - retrieve() returns correct collection by ID', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_cluster001'));
  await storage.store(createResourceInventoryPayload('coll_inventory001'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

  const retrieved = await storage.retrieve('coll_inventory001');

  assert.ok(retrieved, 'Should retrieve collection');
  assert.strictEqual(retrieved?.type, 'resource-inventory', 'Should retrieve correct type');
  assert.strictEqual(
    (retrieved?.data as ResourceInventory).collectionId,
    'coll_inventory001',
    'Should retrieve correct collection'
  );
});

test('LocalStorage - listRecent() returns collections in most recent first order', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_cluster001'));
  await storage.store(createResourceInventoryPayload('coll_inventory001'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

  const recent = await storage.listRecent(3);

  assert.strictEqual(recent.length, 3, 'Should return 3 collections');
  assert.strictEqual(recent[0].type, 'resource-configuration-patterns', 'Most recent should be patterns');
  assert.strictEqual(recent[1].type, 'resource-inventory', 'Second should be inventory');
  assert.strictEqual(recent[2].type, 'cluster-metadata', 'Third should be cluster metadata');
});

test('LocalStorage - listRecent() respects limit parameter', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_cluster001'));
  await storage.store(createResourceInventoryPayload('coll_inventory001'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

  const recent = await storage.listRecent(2);

  assert.strictEqual(recent.length, 2, 'Should return 2 collections');
  assert.strictEqual(recent[0].type, 'resource-configuration-patterns', 'Most recent should be patterns');
  assert.strictEqual(recent[1].type, 'resource-inventory', 'Second should be inventory');
});

test('LocalStorage - listRecent() returns empty array when no collections', async () => {
  const storage = new LocalStorage();
  const recent = await storage.listRecent(10);

  assert.strictEqual(recent.length, 0, 'Should return empty array');
});

test('LocalStorage - listRecent() throws error for negative limit', async () => {
  const storage = new LocalStorage();
  
  await assert.rejects(
    async () => storage.listRecent(-1),
    /limit must be non-negative/,
    'Should throw error for negative limit'
  );
});

test('LocalStorage - store() enforces size limit by removing oldest', async () => {
  const storage = new LocalStorage(3);
  
  await storage.store(createClusterMetadataPayload('coll_001'));
  await storage.store(createResourceInventoryPayload('coll_002'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_003'));
  
  assert.strictEqual(storage.getSize(), 3, 'Should have 3 collections at limit');

  // Add one more to trigger removal of oldest
  await storage.store(createClusterMetadataPayload('coll_004'));
  
  assert.strictEqual(storage.getSize(), 3, 'Should still have 3 collections');

  // Verify oldest was removed
  const oldest = await storage.retrieve('coll_001');
  assert.strictEqual(oldest, null, 'Oldest collection should be removed');

  // Verify newest is present
  const newest = await storage.retrieve('coll_004');
  assert.ok(newest, 'Newest collection should be present');
});

test('LocalStorage - store() updates existing collection and moves to front', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_001'));
  await storage.store(createResourceInventoryPayload('coll_002'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_003'));

  // Update the first collection
  await storage.store(createClusterMetadataPayload('coll_001'));

  const recent = await storage.listRecent(3);
  
  assert.strictEqual(recent.length, 3, 'Should have 3 collections');
  assert.strictEqual(
    (recent[0].data as ClusterMetadata).collectionId,
    'coll_001',
    'Updated collection should be most recent'
  );
});

test('LocalStorage - clear() removes all collections', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_cluster001'));
  await storage.store(createResourceInventoryPayload('coll_inventory001'));
  await storage.store(createResourceConfigurationPatternsPayload('coll_patterns001'));

  assert.strictEqual(storage.getSize(), 3, 'Should have 3 collections');

  await storage.clear();

  assert.strictEqual(storage.getSize(), 0, 'Should have 0 collections after clear');
});

test('LocalStorage - clear() allows new collections after clearing', async () => {
  const storage = new LocalStorage();
  
  await storage.store(createClusterMetadataPayload('coll_001'));
  await storage.clear();
  await storage.store(createResourceConfigurationPatternsPayload('coll_002'));

  assert.strictEqual(storage.getSize(), 1, 'Should have 1 collection');
  
  const retrieved = await storage.retrieve('coll_002');
  assert.ok(retrieved, 'Should retrieve new collection after clear');
});

test('LocalStorage - getSize() returns correct count', async () => {
  const storage = new LocalStorage();
  
  assert.strictEqual(storage.getSize(), 0, 'Should start with 0');
  
  await storage.store(createClusterMetadataPayload('coll_001'));
  assert.strictEqual(storage.getSize(), 1, 'Should have 1 after first store');
  
  await storage.store(createResourceInventoryPayload('coll_002'));
  assert.strictEqual(storage.getSize(), 2, 'Should have 2 after second store');
  
  await storage.store(createResourceConfigurationPatternsPayload('coll_003'));
  assert.strictEqual(storage.getSize(), 3, 'Should have 3 after third store');
});

test('LocalStorage - handles resource configuration patterns data structure correctly', async () => {
  const storage = new LocalStorage();
  const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

  await storage.store(payload);
  const retrieved = await storage.retrieve('coll_patterns001');

  assert.ok(retrieved, 'Should retrieve collection');
  assert.strictEqual(retrieved?.type, 'resource-configuration-patterns', 'Should be resource-configuration-patterns type');
  
  const data = retrieved?.data as ResourceConfigurationPatternsData;
  
  // Verify all required fields are present
  assert.ok(data.timestamp, 'Should have timestamp');
  assert.strictEqual(data.collectionId, 'coll_patterns001', 'Should have correct collectionId');
  assert.strictEqual(data.clusterId, 'cls_test123', 'Should have clusterId');
  assert.ok(data.resourceLimitsRequests, 'Should have resourceLimitsRequests');
  assert.ok(data.replicaCounts, 'Should have replicaCounts');
  assert.ok(data.imagePullPolicies, 'Should have imagePullPolicies');
  assert.ok(data.securityContexts, 'Should have securityContexts');
  assert.ok(data.labelsAnnotations, 'Should have labelsAnnotations');
  assert.ok(data.volumes, 'Should have volumes');
  assert.ok(data.services, 'Should have services');
  assert.ok(data.probes, 'Should have probes');
});

test('LocalStorage - preserves complex nested structures in resource configuration patterns', async () => {
  const storage = new LocalStorage();
  const payload = createResourceConfigurationPatternsPayload('coll_patterns001');

  await storage.store(payload);
  const retrieved = await storage.retrieve('coll_patterns001');

  assert.ok(retrieved, 'Should retrieve collection');
  
  const originalData = payload.data as ResourceConfigurationPatternsData;
  const retrievedData = retrieved?.data as ResourceConfigurationPatternsData;
  
  // Verify deep nested structures are preserved
  assert.deepStrictEqual(
    retrievedData.securityContexts.containerLevel.capabilities,
    originalData.securityContexts.containerLevel.capabilities,
    'Should preserve capabilities structure'
  );
  
  assert.deepStrictEqual(
    retrievedData.volumes.volumeTypes,
    originalData.volumes.volumeTypes,
    'Should preserve volume types'
  );
  
  assert.deepStrictEqual(
    retrievedData.probes.livenessProbes.probeTypes,
    originalData.probes.livenessProbes.probeTypes,
    'Should preserve probe types'
  );
});

