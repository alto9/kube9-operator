import { describe, it, expect, vi } from 'vitest';
import * as k8s from '@kubernetes/client-node';

vi.mock('../../cluster/identifier.js', () => ({
  generateClusterIdForCollection: vi.fn(() => 'cls_' + 'a'.repeat(32)),
}));

import { ClusterMetadataCollector } from './cluster-metadata.js';
import type { KubernetesClient } from '../../kubernetes/client.js';
import type { ClusterMetadata } from '../types.js';
import type { LocalStorage } from '../storage.js';

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

describe('ClusterMetadataCollector', () => {
  it('collect() rejects when the node list is empty', async () => {
    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.28.0' }, []),
      {} as LocalStorage
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
      {} as LocalStorage
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
    const store = vi.fn().mockResolvedValue(undefined);
    const localStorage = { store } as unknown as LocalStorage;

    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.28.0' }, [{ metadata: {} }]),
      localStorage
    );

    const invalid: ClusterMetadata = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      kubernetesVersion: '1.28.0',
      nodeCount: 0,
    };

    await expect(collector.processCollection(invalid)).rejects.toThrow(/nodeCount/i);
    expect(store).not.toHaveBeenCalled();
  });

  it('processCollection() stores a validated payload on success', async () => {
    const store = vi.fn().mockResolvedValue(undefined);
    const localStorage = { store } as unknown as LocalStorage;

    const collector = new ClusterMetadataCollector(
      mockKubernetesClient({ gitVersion: 'v1.29.0' }, [{ metadata: {} }]),
      localStorage
    );

    const meta = await collector.collect();
    await collector.processCollection(meta);

    expect(store).toHaveBeenCalledTimes(1);
    const payload = store.mock.calls[0][0] as { type: string };
    expect(payload.type).toBe('cluster-metadata');
  });
});
