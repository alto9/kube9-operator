import { describe, it, expect, vi } from 'vitest';
import * as k8s from '@kubernetes/client-node';

vi.mock('../../cluster/identifier.js', () => ({
  generateClusterIdForCollection: vi.fn(() => 'cls_' + 'a'.repeat(32)),
}));

import {
  SecurityPostureCollector,
  aggregateSecurityPostureFromPods,
  computeNetworkPolicyCoverage,
} from './security-posture.js';
import type { KubernetesClient } from '../../kubernetes/client.js';
import type { CollectionRepository } from '../../database/collection-repository.js';
import type { SecurityPosture } from '../types.js';
import { validateSecurityPosture } from '../validation.js';

function mockCollectionRepository(
  insertCollection: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(true)
): CollectionRepository {
  return { insertCollection } as unknown as CollectionRepository;
}

function mockKubernetesClient(options: {
  pods?: k8s.V1Pod[];
  namespaces?: k8s.V1Namespace[];
  networkPolicies?: k8s.V1NetworkPolicy[];
  podListError?: Error;
}): KubernetesClient {
  const listPodForAllNamespaces = options.podListError
    ? vi.fn().mockRejectedValue(options.podListError)
    : vi.fn().mockResolvedValue({ items: options.pods ?? [] });

  return {
    coreApi: {
      listPodForAllNamespaces,
      listNamespace: vi.fn().mockResolvedValue({ items: options.namespaces ?? [] }),
    },
    networkingApi: {
      listNetworkPolicyForAllNamespaces: vi
        .fn()
        .mockResolvedValue({ items: options.networkPolicies ?? [] }),
    },
  } as unknown as KubernetesClient;
}

describe('aggregateSecurityPostureFromPods', () => {
  it('counts privileged, hostPath, host network/PID/IPC, and nsaCis rollups', () => {
    const pod: k8s.V1Pod = {
      metadata: { name: 'p1', namespace: 'default' },
      spec: {
        hostNetwork: true,
        hostPID: true,
        automountServiceAccountToken: true,
        volumes: [{ name: 'hp', hostPath: { path: '/data' } }],
        containers: [
          {
            name: 'c1',
            securityContext: {
              privileged: true,
              allowPrivilegeEscalation: true,
              runAsNonRoot: false,
              readOnlyRootFilesystem: false,
              capabilities: { drop: ['NET_RAW'] },
            },
          },
          {
            name: 'c2',
            securityContext: {
              runAsNonRoot: true,
              readOnlyRootFilesystem: true,
              capabilities: { drop: ['ALL'] },
            },
          },
        ],
      },
    };

    const counts = aggregateSecurityPostureFromPods([pod]);
    expect(counts.privilegedContainers).toBe(1);
    expect(counts.hostPathVolumes).toBe(1);
    expect(counts.hostNetworkPods).toBe(1);
    expect(counts.hostPIDPods).toBe(1);
    expect(counts.hostIPCPods).toBe(0);
    expect(counts.nsaCisRollups.allowPrivilegeEscalationTrueContainers).toBe(1);
    expect(counts.nsaCisRollups.runAsNonRootFalseContainers).toBe(1);
    expect(counts.nsaCisRollups.readOnlyRootFilesystemFalseContainers).toBe(1);
    expect(counts.nsaCisRollups.capabilitiesNotDroppedAllContainers).toBe(1);
    expect(counts.nsaCisRollups.automountServiceAccountTokenTruePods).toBe(1);
    expect(counts.nsaCisRollups.hostNamespacesPods).toBe(1);
  });

  it('treats unset automountServiceAccountToken as true', () => {
    const pod: k8s.V1Pod = {
      metadata: { name: 'p1', namespace: 'default' },
      spec: { containers: [{ name: 'c1' }] },
    };

    const counts = aggregateSecurityPostureFromPods([pod]);
    expect(counts.nsaCisRollups.automountServiceAccountTokenTruePods).toBe(1);
  });

  it('does not count automountServiceAccountToken when explicitly false', () => {
    const pod: k8s.V1Pod = {
      metadata: { name: 'p1', namespace: 'default' },
      spec: {
        automountServiceAccountToken: false,
        containers: [{ name: 'c1' }],
      },
    };

    const counts = aggregateSecurityPostureFromPods([pod]);
    expect(counts.nsaCisRollups.automountServiceAccountTokenTruePods).toBe(0);
  });
});

describe('computeNetworkPolicyCoverage', () => {
  it('computes coverageRatio when namespaces exist', () => {
    const namespaces: k8s.V1Namespace[] = [
      { metadata: { name: 'a' } },
      { metadata: { name: 'b' } },
      { metadata: { name: 'c' } },
    ];
    const networkPolicies: k8s.V1NetworkPolicy[] = [
      { metadata: { name: 'np1', namespace: 'a' } },
      { metadata: { name: 'np2', namespace: 'b' } },
    ];

    const coverage = computeNetworkPolicyCoverage(namespaces, networkPolicies);
    expect(coverage).toEqual({
      namespacesTotal: 3,
      namespacesWithNetworkPolicy: 2,
      coverageRatio: 2 / 3,
    });
  });

  it('omits coverageRatio when namespacesTotal is 0', () => {
    const coverage = computeNetworkPolicyCoverage([], []);
    expect(coverage).toEqual({
      namespacesTotal: 0,
      namespacesWithNetworkPolicy: 0,
    });
    expect(coverage.coverageRatio).toBeUndefined();
  });
});

describe('validateSecurityPosture', () => {
  it('requires all six nsaCisRollups keys', () => {
    const incomplete = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      privilegedHost: {
        privilegedContainers: 0,
        hostPathVolumes: 0,
        hostNetworkPods: 0,
        hostPIDPods: 0,
        hostIPCPods: 0,
      },
      networkPolicyCoverage: {
        namespacesTotal: 1,
        namespacesWithNetworkPolicy: 0,
      },
      nsaCisRollups: {
        allowPrivilegeEscalationTrueContainers: 0,
        runAsNonRootFalseContainers: 0,
        readOnlyRootFilesystemFalseContainers: 0,
        capabilitiesNotDroppedAllContainers: 0,
        automountServiceAccountTokenTruePods: 0,
      },
    };

    expect(() => validateSecurityPosture(incomplete)).toThrow(/expected exactly 6 keys/);
  });

  it('rejects unknown nsaCisRollups keys', () => {
    const withExtra = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      privilegedHost: {
        privilegedContainers: 0,
        hostPathVolumes: 0,
        hostNetworkPods: 0,
      },
      networkPolicyCoverage: {
        namespacesTotal: 0,
        namespacesWithNetworkPolicy: 0,
      },
      nsaCisRollups: {
        allowPrivilegeEscalationTrueContainers: 0,
        runAsNonRootFalseContainers: 0,
        readOnlyRootFilesystemFalseContainers: 0,
        capabilitiesNotDroppedAllContainers: 0,
        automountServiceAccountTokenTruePods: 0,
        hostNamespacesPods: 0,
        extraKey: 1,
      },
    };

    expect(() => validateSecurityPosture(withExtra)).toThrow(/expected exactly 6 keys, got 7/);
  });
});

describe('SecurityPostureCollector', () => {
  it('collect() returns a complete security-posture snapshot from API fixtures', async () => {
    const collector = new SecurityPostureCollector(
      mockKubernetesClient({
        pods: [
          {
            metadata: { name: 'p1', namespace: 'default' },
            spec: {
              containers: [{ name: 'c1', securityContext: { privileged: true } }],
            },
          },
        ],
        namespaces: [{ metadata: { name: 'default' } }],
        networkPolicies: [],
      }),
      mockCollectionRepository()
    );

    const posture = await collector.collect();
    expect(posture.privilegedHost.privilegedContainers).toBe(1);
    expect(posture.networkPolicyCoverage.namespacesTotal).toBe(1);
    expect(posture.networkPolicyCoverage.namespacesWithNetworkPolicy).toBe(0);
    expect(posture.nsaCisRollups.hostNamespacesPods).toBe(0);
    expect(Object.keys(posture.nsaCisRollups)).toHaveLength(6);
    expect(posture.collectionId).toMatch(/^coll_[a-f0-9]{32}$/);
  });

  it('collect() rejects when a required list fails mid-tick', async () => {
    const collector = new SecurityPostureCollector(
      mockKubernetesClient({
        podListError: new Error('pods forbidden'),
        namespaces: [{ metadata: { name: 'default' } }],
      }),
      mockCollectionRepository()
    );

    await expect(collector.collect()).rejects.toThrow(/pods forbidden/i);
  });

  it('processCollection() persists a validated security-posture payload', async () => {
    const insertCollection = vi.fn().mockReturnValue(true);
    const collector = new SecurityPostureCollector(
      mockKubernetesClient({}),
      mockCollectionRepository(insertCollection)
    );

    const posture: SecurityPosture = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      privilegedHost: {
        privilegedContainers: 1,
        hostPathVolumes: 0,
        hostNetworkPods: 0,
        hostPIDPods: 0,
        hostIPCPods: 0,
      },
      networkPolicyCoverage: {
        namespacesTotal: 2,
        namespacesWithNetworkPolicy: 1,
        coverageRatio: 0.5,
      },
      nsaCisRollups: {
        allowPrivilegeEscalationTrueContainers: 0,
        runAsNonRootFalseContainers: 1,
        readOnlyRootFilesystemFalseContainers: 1,
        capabilitiesNotDroppedAllContainers: 1,
        automountServiceAccountTokenTruePods: 1,
        hostNamespacesPods: 0,
      },
    };

    await collector.processCollection(posture);

    expect(insertCollection).toHaveBeenCalledTimes(1);
    const payload = insertCollection.mock.calls[0][0];
    expect(payload.type).toBe('security-posture');
    expect(payload.data.collectionId).toBe(posture.collectionId);
  });

  it('processCollection() throws when persist returns false', async () => {
    const insertCollection = vi.fn().mockReturnValue(false);
    const collector = new SecurityPostureCollector(
      mockKubernetesClient({}),
      mockCollectionRepository(insertCollection)
    );

    const posture: SecurityPosture = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      privilegedHost: {
        privilegedContainers: 0,
        hostPathVolumes: 0,
        hostNetworkPods: 0,
        hostPIDPods: 0,
        hostIPCPods: 0,
      },
      networkPolicyCoverage: {
        namespacesTotal: 0,
        namespacesWithNetworkPolicy: 0,
      },
      nsaCisRollups: {
        allowPrivilegeEscalationTrueContainers: 0,
        runAsNonRootFalseContainers: 0,
        readOnlyRootFilesystemFalseContainers: 0,
        capabilitiesNotDroppedAllContainers: 0,
        automountServiceAccountTokenTruePods: 0,
        hostNamespacesPods: 0,
      },
    };

    await expect(collector.processCollection(posture)).rejects.toThrow(/Failed to persist/i);
  });
});
