import { describe, it, expect, vi } from 'vitest';
import * as k8s from '@kubernetes/client-node';

vi.mock('../../cluster/identifier.js', () => ({
  generateClusterIdForCollection: vi.fn(() => 'cls_' + 'a'.repeat(32)),
}));

import { ClusterMetadataCollector } from './cluster-metadata.js';
import type { KubernetesClient } from '../../kubernetes/client.js';
import type { ClusterMetadata } from '../types.js';
import type { CollectionRepository } from '../../database/collection-repository.js';

function mockKubernetesClient(
  versionResponse: { gitVersion?: string },
  nodes: k8s.V1Node[]
): KubernetesClient {
  return {
    versionApi: {
      getCode: vi.fn().mockResolvedValue(versionResponse),
    },
    coreApi: {
      listNode: vi.fn().mockResolvedValue({ items: nodes }),
    },
  } as unknown as KubernetesClient;
}

function mockCollectionRepository(
  insertCollection: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(true)
): CollectionRepository {
  return { insertCollection } as unknown as CollectionRepository;
}

describe('ClusterMetadataCollector', () => {
  it('collect() rejects when the node list is empty', async () => {
    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.28.0' }, []),
      mockCollectionRepository()
    );

    await expect(collector.collect()).rejects.toThrow(/node list is empty/i);
  });

  it('collect() returns metadata when at least one node exists', async () => {
    const node: k8s.V1Node = {
      metadata: {
        labels: {
          'topology.kubernetes.io/region': 'us-east-1',
          'topology.kubernetes.io/zone': 'us-east-1a',
        },
      },
    };

    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.28.2' }, [node]),
      mockCollectionRepository()
    );

    const meta = await collector.collect();
    expect(meta.nodeCount).toBe(1);
    expect(meta.kubernetesVersion).toBe('1.28.2');
    expect(meta.region).toBe('us-east-1');
    expect(meta.zone).toBe('us-east-1a');
    expect(meta.collectionId).toMatch(/^coll_[a-f0-9]{32}$/);
    expect(meta.clusterId).toMatch(/^cls_[a-f0-9]{32}$/);
  });

  it('processCollection() propagates validation errors (metrics alignment)', async () => {
    const insertCollection = vi.fn().mockReturnValue(true);
    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.28.0' }, [{ metadata: {} }]),
      mockCollectionRepository(insertCollection)
    );

    const invalid: ClusterMetadata = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      kubernetesVersion: '1.28.0',
      nodeCount: 0,
    };

    await expect(collector.processCollection(invalid)).rejects.toThrow(/nodeCount/i);
    expect(insertCollection).not.toHaveBeenCalled();
  });

  it('processCollection() persists a validated payload on success', async () => {
    const insertCollection = vi.fn().mockReturnValue(true);
    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.29.0' }, [{ metadata: {} }]),
      mockCollectionRepository(insertCollection)
    );

    const meta = await collector.collect();
    await collector.processCollection(meta);

    expect(insertCollection).toHaveBeenCalledTimes(1);
    const payload = insertCollection.mock.calls[0][0] as { type: string };
    expect(payload.type).toBe('cluster-metadata');
  });

  it('processCollection() throws when durable insert fails', async () => {
    const insertCollection = vi.fn().mockReturnValue(false);
    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.29.0' }, [{ metadata: {} }]),
      mockCollectionRepository(insertCollection)
    );

    const meta = await collector.collect();
    await expect(collector.processCollection(meta)).rejects.toThrow(/Failed to persist cluster metadata/i);
  });
});
