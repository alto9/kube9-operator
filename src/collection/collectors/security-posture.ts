/**
 * Security posture collector: bounded cluster-API aggregate snapshots on ~24h schedule.
 */

import { randomBytes } from 'crypto';
import * as k8s from '@kubernetes/client-node';
import type { CollectionPayload, SecurityPosture, SecurityPostureNsaCisRollups } from '../types.js';
import { validateSecurityPosture } from '../validation.js';
import type { CollectionRepository } from '../../database/collection-repository.js';
import { persistCollection } from '../persist-collection.js';
import { KubernetesClient } from '../../kubernetes/client.js';
import { generateClusterIdForCollection } from '../../cluster/identifier.js';
import { logger } from '../../logging/logger.js';

export interface SecurityPostureAggregateCounts {
  privilegedContainers: number;
  hostPathVolumes: number;
  hostNetworkPods: number;
  hostPIDPods: number;
  hostIPCPods: number;
  nsaCisRollups: SecurityPostureNsaCisRollups;
  automountServiceAccountTokenTruePods: number;
}

function normalizeCapability(cap: string): string {
  return cap.replace(/^CAP_/i, '').toUpperCase();
}

function capabilitiesDropIncludesAll(drop: string[] | undefined): boolean {
  if (!drop || drop.length === 0) {
    return false;
  }
  return drop.some((cap) => normalizeCapability(cap) === 'ALL');
}

function podContainers(pod: k8s.V1Pod): k8s.V1Container[] {
  return [
    ...(pod.spec?.containers ?? []),
    ...(pod.spec?.initContainers ?? []),
    ...(pod.spec?.ephemeralContainers ?? []),
  ];
}

function isAutomountServiceAccountTokenTrue(pod: k8s.V1Pod): boolean {
  const value = pod.spec?.automountServiceAccountToken;
  return value !== false;
}

/**
 * Walks pods and returns bounded security-posture aggregate counts.
 */
export function aggregateSecurityPostureFromPods(pods: k8s.V1Pod[]): SecurityPostureAggregateCounts {
  const counts: SecurityPostureAggregateCounts = {
    privilegedContainers: 0,
    hostPathVolumes: 0,
    hostNetworkPods: 0,
    hostPIDPods: 0,
    hostIPCPods: 0,
    automountServiceAccountTokenTruePods: 0,
    nsaCisRollups: {
      allowPrivilegeEscalationTrueContainers: 0,
      runAsNonRootFalseContainers: 0,
      readOnlyRootFilesystemFalseContainers: 0,
      capabilitiesNotDroppedAllContainers: 0,
      automountServiceAccountTokenTruePods: 0,
      hostNamespacesPods: 0,
    },
  };

  for (const pod of pods) {
    const podSecurityContext = pod.spec?.securityContext;

    if (pod.spec?.hostNetwork === true) {
      counts.hostNetworkPods++;
    }
    if (pod.spec?.hostPID === true) {
      counts.hostPIDPods++;
    }
    if (pod.spec?.hostIPC === true) {
      counts.hostIPCPods++;
    }
    if (pod.spec?.hostPID === true || pod.spec?.hostIPC === true) {
      counts.nsaCisRollups.hostNamespacesPods++;
    }
    if (isAutomountServiceAccountTokenTrue(pod)) {
      counts.automountServiceAccountTokenTruePods++;
      counts.nsaCisRollups.automountServiceAccountTokenTruePods++;
    }

    for (const volume of pod.spec?.volumes ?? []) {
      if (volume.hostPath) {
        counts.hostPathVolumes++;
      }
    }

    for (const container of podContainers(pod)) {
      const securityContext = container.securityContext;

      if (securityContext?.privileged === true) {
        counts.privilegedContainers++;
      }

      const effectiveAllowPrivilegeEscalation = securityContext?.allowPrivilegeEscalation;
      if (effectiveAllowPrivilegeEscalation === true) {
        counts.nsaCisRollups.allowPrivilegeEscalationTrueContainers++;
      }

      const effectiveRunAsNonRoot = securityContext?.runAsNonRoot ?? podSecurityContext?.runAsNonRoot;
      if (effectiveRunAsNonRoot !== true) {
        counts.nsaCisRollups.runAsNonRootFalseContainers++;
      }

      const effectiveReadOnlyRootFilesystem = securityContext?.readOnlyRootFilesystem;
      if (effectiveReadOnlyRootFilesystem !== true) {
        counts.nsaCisRollups.readOnlyRootFilesystemFalseContainers++;
      }

      const drop = securityContext?.capabilities?.drop;
      if (!capabilitiesDropIncludesAll(drop)) {
        counts.nsaCisRollups.capabilitiesNotDroppedAllContainers++;
      }
    }
  }

  return counts;
}

export function computeNetworkPolicyCoverage(
  namespaces: k8s.V1Namespace[],
  networkPolicies: k8s.V1NetworkPolicy[]
): SecurityPosture['networkPolicyCoverage'] {
  const namespacesTotal = namespaces.length;
  const namespaceNames = new Set(
    namespaces.map((ns) => ns.metadata?.name).filter((name): name is string => Boolean(name))
  );

  const coveredNamespaces = new Set<string>();
  for (const policy of networkPolicies) {
    const ns = policy.metadata?.namespace;
    if (ns && namespaceNames.has(ns)) {
      coveredNamespaces.add(ns);
    }
  }

  const namespacesWithNetworkPolicy = coveredNamespaces.size;
  const coverage: SecurityPosture['networkPolicyCoverage'] = {
    namespacesTotal,
    namespacesWithNetworkPolicy,
  };

  if (namespacesTotal > 0) {
    coverage.coverageRatio = namespacesWithNetworkPolicy / namespacesTotal;
  }

  return coverage;
}

export class SecurityPostureCollector {
  private readonly kubernetesClient: KubernetesClient;
  private readonly collectionRepository: CollectionRepository;

  constructor(kubernetesClient: KubernetesClient, collectionRepository: CollectionRepository) {
    this.kubernetesClient = kubernetesClient;
    this.collectionRepository = collectionRepository;
  }

  /**
   * Gathers cluster-API aggregates for a security-posture snapshot.
   * @throws when any required list/read fails (failed tick; no row persisted)
   */
  async collect(): Promise<SecurityPosture> {
    logger.info('Starting security posture collection');

    const [podList, namespaceList, networkPolicyList] = await Promise.all([
      this.kubernetesClient.coreApi.listPodForAllNamespaces(),
      this.kubernetesClient.coreApi.listNamespace(),
      this.kubernetesClient.networkingApi.listNetworkPolicyForAllNamespaces(),
    ]);

    const pods = podList.items ?? [];
    const namespaces = namespaceList.items ?? [];
    const networkPolicies = networkPolicyList.items ?? [];

    const aggregates = aggregateSecurityPostureFromPods(pods);
    const networkPolicyCoverage = computeNetworkPolicyCoverage(namespaces, networkPolicies);

    const posture: SecurityPosture = {
      timestamp: new Date().toISOString(),
      collectionId: this.generateCollectionId(),
      clusterId: generateClusterIdForCollection(),
      privilegedHost: {
        privilegedContainers: aggregates.privilegedContainers,
        hostPathVolumes: aggregates.hostPathVolumes,
        hostNetworkPods: aggregates.hostNetworkPods,
        hostPIDPods: aggregates.hostPIDPods,
        hostIPCPods: aggregates.hostIPCPods,
      },
      networkPolicyCoverage,
      nsaCisRollups: aggregates.nsaCisRollups,
    };

    logger.info('Security posture collected successfully', {
      collectionId: posture.collectionId,
      clusterId: posture.clusterId,
      privilegedContainers: posture.privilegedHost.privilegedContainers,
      namespacesTotal: posture.networkPolicyCoverage.namespacesTotal,
      namespacesWithNetworkPolicy: posture.networkPolicyCoverage.namespacesWithNetworkPolicy,
    });

    return posture;
  }

  async processCollection(posture: SecurityPosture): Promise<void> {
    try {
      const validated = validateSecurityPosture(posture);

      const payload: CollectionPayload = {
        version: 'v1.0.0',
        type: 'security-posture',
        data: validated,
        sanitization: {
          rulesApplied: ['bounded-counts', 'closed-nsa-cis-rollups', 'hashed-cluster-id'],
          timestamp: new Date().toISOString(),
        },
      };

      logger.info('Persisting security posture collection', {
        collectionId: validated.collectionId,
      });
      const inserted = persistCollection(this.collectionRepository, payload);
      if (!inserted) {
        throw new Error(`Failed to persist security posture collection: ${validated.collectionId}`);
      }

      logger.info('Security posture collection processed successfully', {
        collectionId: validated.collectionId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process security posture collection', {
        error: errorMessage,
        collectionId: posture.collectionId,
      });
      throw error;
    }
  }

  private generateCollectionId(): string {
    return `coll_${randomBytes(16).toString('hex')}`;
  }
}
