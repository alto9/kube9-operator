import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { CollectionRepository } from './collection-repository.js';
import type { CollectionPayload } from '../collection/types.js';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-collection-repo-temp');

function sampleClusterPayload(id: string): CollectionPayload {
  const ts = new Date().toISOString();
  return {
    version: 'v1.0.0',
    type: 'cluster-metadata',
    data: {
      timestamp: ts,
      collectionId: id,
      clusterId: 'cls_testabc',
      kubernetesVersion: '1.28.0',
      nodeCount: 2,
    },
    sanitization: {
      rulesApplied: ['hash-identifiers'],
      timestamp: ts,
    },
  };
}

describe('CollectionRepository', () => {
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
    const dbFile = path.join(testDbDir, 'kube9.db');
    if (existsSync(dbFile)) {
      unlinkSync(dbFile);
    }
    const schema = new SchemaManager();
    schema.initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  it('inserts and retrieves a valid collection', () => {
    const repo = new CollectionRepository();
    const payload = sampleClusterPayload('coll_ins1');
    expect(repo.insertCollection(payload)).toBe(true);

    const got = repo.getCollectionById('coll_ins1');
    expect(got).toBeTruthy();
    expect(got?.type).toBe('cluster-metadata');
    expect(got?.data).toEqual(payload.data);
  });

  it('rejects invalid payload', () => {
    const repo = new CollectionRepository();
    const bad = { version: 'v1', type: 'cluster-metadata', data: {}, sanitization: { rulesApplied: [], timestamp: 'x' } };
    expect(repo.insertCollection(bad)).toBe(false);
  });

  it('rejects wrong enum type in database sense via zod alignment', () => {
    const repo = new CollectionRepository();
    const payload = sampleClusterPayload('coll_x');
    const mangled = {
      ...payload,
      type: 'resource-inventory' as const,
    };
    expect(repo.insertCollection(mangled)).toBe(false);
  });

  it('lists and counts with filters', () => {
    const repo = new CollectionRepository();
    const p1 = sampleClusterPayload('coll_a');
    const p2: CollectionPayload = {
      ...sampleClusterPayload('coll_b'),
      data: {
        ...sampleClusterPayload('coll_b').data,
        clusterId: 'cls_other',
        timestamp: new Date(Date.now() + 1000).toISOString(),
      },
    };
    repo.insertCollection(p1);
    repo.insertCollection(p2);

    const all = repo.queryCollectionSummaries({ limit: 10, offset: 0 });
    expect(all.length).toBe(2);
    expect(repo.countCollections({})).toBe(2);

    const forCluster = repo.queryCollectionSummaries({
      filters: { cluster_id: 'cls_other' },
      limit: 10,
      offset: 0,
    });
    expect(forCluster.length).toBe(1);
    expect(forCluster[0].collection_id).toBe('coll_b');
  });

  it('returns false on duplicate collection id', () => {
    const repo = new CollectionRepository();
    const payload = sampleClusterPayload('coll_dup');
    expect(repo.insertCollection(payload)).toBe(true);
    expect(repo.insertCollection(payload)).toBe(false);
  });

  it('inserts and retrieves valid performance-metrics payload', () => {
    const repo = new CollectionRepository();
    const ts = new Date().toISOString();
    const payload: CollectionPayload = {
      version: 'v1.0.0',
      type: 'performance-metrics',
      data: {
        timestamp: ts,
        collectionId: 'coll_perf123456789012345678901234',
        clusterId: 'cls_testabc1234567890123456789012',
        source: { available: true },
        utilization: { cpu: { clusterAvgRatio: 0.25 } },
      },
      sanitization: { rulesApplied: ['hash-identifiers'], timestamp: ts },
    };
    expect(repo.insertCollection(payload)).toBe(true);
    const got = repo.getCollectionById('coll_perf123456789012345678901234');
    expect(got?.type).toBe('performance-metrics');
    expect(got?.data).toEqual(payload.data);
  });

  it('inserts and retrieves valid security-posture payload', () => {
    const repo = new CollectionRepository();
    const ts = new Date().toISOString();
    const payload: CollectionPayload = {
      version: 'v1.0.0',
      type: 'security-posture',
      data: {
        timestamp: ts,
        collectionId: 'coll_sec1234567890123456789012345',
        clusterId: 'cls_testabc1234567890123456789012',
        privilegedHost: {
          privilegedContainers: 1,
          hostPathVolumes: 0,
          hostNetworkPods: 0,
        },
        networkPolicyCoverage: {
          namespacesTotal: 5,
          namespacesWithNetworkPolicy: 3,
        },
        nsaCisRollups: {
          allowPrivilegeEscalationTrueContainers: 0,
          runAsNonRootFalseContainers: 1,
          readOnlyRootFilesystemFalseContainers: 2,
          capabilitiesNotDroppedAllContainers: 0,
          automountServiceAccountTokenTruePods: 1,
          hostNamespacesPods: 0,
        },
      },
      sanitization: { rulesApplied: ['hash-identifiers'], timestamp: ts },
    };
    expect(repo.insertCollection(payload)).toBe(true);
    const got = repo.getCollectionById('coll_sec1234567890123456789012345');
    expect(got?.type).toBe('security-posture');
    expect(got?.data).toEqual(payload.data);
  });

  it('rejects security-posture payload with vulnerabilities field', () => {
    const repo = new CollectionRepository();
    const ts = new Date().toISOString();
    const bad = {
      version: 'v1.0.0',
      type: 'security-posture',
      data: {
        timestamp: ts,
        collectionId: 'coll_bad123456789012345678901234',
        clusterId: 'cls_testabc1234567890123456789012',
        privilegedHost: { privilegedContainers: 0, hostPathVolumes: 0, hostNetworkPods: 0 },
        networkPolicyCoverage: { namespacesTotal: 1, namespacesWithNetworkPolicy: 0 },
        nsaCisRollups: {
          allowPrivilegeEscalationTrueContainers: 0,
          runAsNonRootFalseContainers: 0,
          readOnlyRootFilesystemFalseContainers: 0,
          capabilitiesNotDroppedAllContainers: 0,
          automountServiceAccountTokenTruePods: 0,
          hostNamespacesPods: 0,
        },
        vulnerabilities: [],
      },
      sanitization: { rulesApplied: [], timestamp: ts },
    };
    expect(repo.insertCollection(bad)).toBe(false);
    expect(repo.countCollections({})).toBe(0);
  });
});
