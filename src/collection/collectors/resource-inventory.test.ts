import { describe, it, expect, vi } from 'vitest';
import * as k8s from '@kubernetes/client-node';
import { createHash } from 'crypto';

vi.mock('../../cluster/identifier.js', () => ({
  generateClusterIdForCollection: vi.fn(() => 'cls_' + 'a'.repeat(32)),
}));

import { ResourceInventoryCollector } from './resource-inventory.js';
import type { KubernetesClient } from '../../kubernetes/client.js';
import type { LocalStorage } from '../storage.js';

function nsId(name: string): string {
  return `namespace-${createHash('sha256').update(name).digest('hex').substring(0, 12)}`;
}

function mockKubernetesClient(): KubernetesClient {
  const listNamespace = vi.fn().mockResolvedValue({
    items: [
      { metadata: { name: 'team-a' } },
      { metadata: { name: 'team-b' } },
    ] satisfies k8s.V1Namespace[],
  });

  const listPodForAllNamespaces = vi.fn().mockResolvedValue({
    items: [
      { metadata: { namespace: 'team-a' } },
      { metadata: { namespace: 'team-a' } },
      { metadata: { namespace: 'team-b' } },
    ] satisfies k8s.V1Pod[],
  });

  const listDeploymentForAllNamespaces = vi.fn().mockResolvedValue({
    items: [{ metadata: {} }, { metadata: {} }, { metadata: {} }] satisfies k8s.V1Deployment[],
  });

  const listStatefulSetForAllNamespaces = vi.fn().mockResolvedValue({
    items: [{ metadata: {} }] satisfies k8s.V1StatefulSet[],
  });

  const listReplicaSetForAllNamespaces = vi.fn().mockResolvedValue({
    items: [{ metadata: {} }, { metadata: {} }] satisfies k8s.V1ReplicaSet[],
  });

  const listServiceForAllNamespaces = vi.fn().mockResolvedValue({
    items: [
      { metadata: {}, spec: { type: 'ClusterIP' } },
      { metadata: {}, spec: { type: 'ClusterIP' } },
      { metadata: {}, spec: { type: 'NodePort' } },
      { metadata: {}, spec: { type: 'LoadBalancer' } },
      { metadata: {}, spec: { type: 'ExternalName' } },
    ] satisfies k8s.V1Service[],
  });

  return {
    coreApi: {
      listNamespace,
      listPodForAllNamespaces,
      listServiceForAllNamespaces,
    },
    appsApi: {
      listDeploymentForAllNamespaces,
      listStatefulSetForAllNamespaces,
      listReplicaSetForAllNamespaces,
    },
  } as unknown as KubernetesClient;
}

describe('ResourceInventoryCollector', () => {
  it('collect() hashes namespace names and aggregates counts', async () => {
    const k8sClient = mockKubernetesClient();
    const collector = new ResourceInventoryCollector(k8sClient, {} as LocalStorage);

    const inv = await collector.collect();

    expect(inv.namespaces.count).toBe(2);
    expect(inv.namespaces.list).toHaveLength(2);
    expect(inv.namespaces.list).toContain(nsId('team-a'));
    expect(inv.namespaces.list).toContain(nsId('team-b'));
    for (const id of inv.namespaces.list) {
      expect(id).toMatch(/^namespace-[a-f0-9]{12}$/);
    }
    expect(inv.namespaces.list.some((id) => id.includes('team'))).toBe(false);

    expect(inv.resources.pods.total).toBe(3);
    expect(inv.resources.pods.byNamespace[nsId('team-a')]).toBe(2);
    expect(inv.resources.pods.byNamespace[nsId('team-b')]).toBe(1);

    expect(inv.resources.deployments.total).toBe(3);
    expect(inv.resources.statefulSets.total).toBe(1);
    expect(inv.resources.replicaSets.total).toBe(2);

    expect(inv.resources.services.total).toBe(5);
    expect(inv.resources.services.byType.ClusterIP).toBe(2);
    expect(inv.resources.services.byType.NodePort).toBe(1);
    expect(inv.resources.services.byType.LoadBalancer).toBe(1);
    expect(inv.resources.services.byType.ExternalName).toBe(1);

    expect(inv.collectionId).toMatch(/^coll_[a-f0-9]{32}$/);
    expect(inv.clusterId).toMatch(/^cls_[a-f0-9]{32}$/);
  });

  it('collect() defaults service type to ClusterIP when spec.type is missing', async () => {
    const k8sClient = mockKubernetesClient();
    const core = k8sClient.coreApi as unknown as {
      listServiceForAllNamespaces: ReturnType<typeof vi.fn>;
    };
    core.listServiceForAllNamespaces.mockResolvedValue({
      items: [{ metadata: {}, spec: {} }],
    });

    const collector = new ResourceInventoryCollector(k8sClient, {} as LocalStorage);
    const inv = await collector.collect();

    expect(inv.resources.services.total).toBe(1);
    expect(inv.resources.services.byType.ClusterIP).toBe(1);
  });

  it('processCollection() stores a validated resource-inventory payload', async () => {
    const k8sClient = mockKubernetesClient();
    const store = vi.fn().mockResolvedValue(undefined);
    const localStorage = { store } as unknown as LocalStorage;

    const collector = new ResourceInventoryCollector(k8sClient, localStorage);
    const inv = await collector.collect();
    await collector.processCollection(inv);

    expect(store).toHaveBeenCalledTimes(1);
    const payload = store.mock.calls[0][0] as {
      type: string;
      sanitization: { rulesApplied: string[] };
    };
    expect(payload.type).toBe('resource-inventory');
    expect(payload.sanitization.rulesApplied).toEqual([
      'no-resource-names',
      'hashed-namespace-ids',
    ]);
  });

  it('processCollection() does not store when validation fails', async () => {
    const store = vi.fn().mockResolvedValue(undefined);
    const localStorage = { store } as unknown as LocalStorage;
    const collector = new ResourceInventoryCollector(
      mockKubernetesClient(),
      localStorage
    );

    await collector.processCollection({
      timestamp: new Date().toISOString(),
      collectionId: 'bad-id',
      clusterId: 'cls_' + 'a'.repeat(32),
      namespaces: { count: 0, list: [] },
      resources: {
        pods: { total: 0, byNamespace: {} },
        deployments: { total: 0 },
        statefulSets: { total: 0 },
        replicaSets: { total: 0 },
        services: { total: 0, byType: {} },
      },
    });

    expect(store).not.toHaveBeenCalled();
  });
});
