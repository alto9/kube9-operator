/**
 * Resource inventory collector implementation
 * 
 * Collects Kubernetes resource inventory including namespace counts/lists,
 * pod counts, deployment counts, statefulSet counts, replicaSet counts,
 * and service counts by type on a 6-hour interval.
 */

import { randomBytes, createHash } from 'crypto';
import * as k8s from '@kubernetes/client-node';
import type { ResourceInventory, CollectionPayload } from '../types.js';
import { validateResourceInventory } from '../validation.js';
import { LocalStorage } from '../storage.js';
import { TransmissionClient } from '../transmission.js';
import { KubernetesClient } from '../../kubernetes/client.js';
import { generateClusterIdForCollection } from '../../cluster/identifier.js';
import type { Config } from '../../config/types.js';
import { logger } from '../../logging/logger.js';

/**
 * ResourceInventoryCollector collects resource inventory and processes it
 * through validation, storage (free tier), or transmission (pro tier).
 */
export class ResourceInventoryCollector {
  private readonly kubernetesClient: KubernetesClient;
  private readonly localStorage: LocalStorage;
  private readonly transmissionClient: TransmissionClient | null;
  private readonly config: Config;

  /**
   * Creates a new ResourceInventoryCollector instance
   * 
   * @param kubernetesClient - Kubernetes client for API access
   * @param localStorage - Local storage for free tier
   * @param transmissionClient - Transmission client for pro tier (null if free tier)
   * @param config - Configuration to determine tier
   */
  constructor(
    kubernetesClient: KubernetesClient,
    localStorage: LocalStorage,
    transmissionClient: TransmissionClient | null,
    config: Config
  ) {
    this.kubernetesClient = kubernetesClient;
    this.localStorage = localStorage;
    this.transmissionClient = transmissionClient;
    this.config = config;
  }

  /**
   * Collects resource inventory from the Kubernetes API
   * 
   * @returns Promise resolving to collected resource inventory
   * @throws Error if collection fails (will be caught by scheduler)
   */
  async collect(): Promise<ResourceInventory> {
    logger.info('Starting resource inventory collection');

    try {
      // Generate collection ID
      const collectionId = this.generateCollectionId();

      // Generate cluster identifier
      const clusterId = generateClusterIdForCollection();

      // Create ISO 8601 timestamp
      const timestamp = new Date().toISOString();

      // Collect namespaces
      const namespaces = await this.collectNamespaces();

      // Collect pod counts
      const podCounts = await this.collectPodCounts();

      // Collect deployment counts
      const deploymentCounts = await this.collectDeploymentCounts();

      // Collect statefulSet counts
      const statefulSetCounts = await this.collectStatefulSetCounts();

      // Collect replicaSet counts
      const replicaSetCounts = await this.collectReplicaSetCounts();

      // Collect service counts
      const serviceCounts = await this.collectServiceCounts();

      const inventory: ResourceInventory = {
        timestamp,
        collectionId,
        clusterId,
        namespaces,
        resources: {
          pods: podCounts,
          deployments: deploymentCounts,
          statefulSets: statefulSetCounts,
          replicaSets: replicaSetCounts,
          services: serviceCounts,
        },
      };

      logger.info('Resource inventory collected successfully', {
        collectionId,
        clusterId,
        namespaceCount: namespaces.count,
        podTotal: podCounts.total,
        deploymentTotal: deploymentCounts.total,
        statefulSetTotal: statefulSetCounts.total,
        replicaSetTotal: replicaSetCounts.total,
        serviceTotal: serviceCounts.total,
      });

      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to collect resource inventory', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Processes collected inventory: validates, wraps in payload, and stores/transmits
   * 
   * @param inventory - Collected resource inventory
   * @returns Promise that resolves when processing is complete
   */
  async processCollection(inventory: ResourceInventory): Promise<void> {
    try {
      // Validate the collected data
      const validatedInventory = validateResourceInventory(inventory);

      // Wrap in collection payload with sanitization metadata
      const payload: CollectionPayload = {
        version: 'v1.0.0',
        type: 'resource-inventory',
        data: validatedInventory,
        sanitization: {
          rulesApplied: ['no-resource-names', 'hashed-namespace-ids'],
          timestamp: new Date().toISOString(),
        },
      };

      // Determine tier and process accordingly
      if (this.config.apiKey && this.transmissionClient) {
        // Pro tier: transmit to server
        logger.info('Transmitting resource inventory collection (pro tier)', {
          collectionId: validatedInventory.collectionId,
        });
        await this.transmissionClient.transmit(payload);
      } else {
        // Free tier: store locally
        logger.info('Storing resource inventory collection locally (free tier)', {
          collectionId: validatedInventory.collectionId,
        });
        await this.localStorage.store(payload);
      }

      logger.info('Resource inventory collection processed successfully', {
        collectionId: validatedInventory.collectionId,
        tier: this.config.apiKey ? 'pro' : 'free',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process resource inventory collection', {
        error: errorMessage,
        collectionId: inventory.collectionId,
      });
      // Don't throw - graceful degradation
    }
  }

  /**
   * Generates a unique collection ID in format coll_[32-char-hash]
   * 
   * @returns Collection ID string
   */
  private generateCollectionId(): string {
    const random = randomBytes(16).toString('hex');
    return `coll_${random}`;
  }

  /**
   * Hashes a namespace name to create a privacy-preserving identifier
   * 
   * @param name - Namespace name to hash
   * @returns Hashed namespace identifier in format namespace-[12-char-hash]
   */
  private hashNamespace(name: string): string {
    const hash = createHash('sha256')
      .update(name)
      .digest('hex')
      .substring(0, 12);
    return `namespace-${hash}`;
  }

  /**
   * Collects namespace information (count and hashed list)
   * 
   * @returns Promise resolving to namespace count and hashed list
   */
  private async collectNamespaces(): Promise<{ count: number; list: string[] }> {
    const namespaceList = await this.kubernetesClient.coreApi.listNamespace();
    const items = namespaceList.items || [];

    const hashedNamespaces = items.map((ns: k8s.V1Namespace) => {
      const name = ns.metadata?.name || '';
      return this.hashNamespace(name);
    });

    return {
      count: items.length,
      list: hashedNamespaces,
    };
  }

  /**
   * Collects pod counts (total and by namespace)
   * 
   * @returns Promise resolving to pod counts with total and byNamespace distribution
   */
  private async collectPodCounts(): Promise<{ total: number; byNamespace: Record<string, number> }> {
    const podList = await this.kubernetesClient.coreApi.listPodForAllNamespaces();
    const items = podList.items || [];

    const byNamespace: Record<string, number> = {};

    items.forEach((pod: k8s.V1Pod) => {
      const namespace = pod.metadata?.namespace || '';
      const namespaceId = this.hashNamespace(namespace);
      byNamespace[namespaceId] = (byNamespace[namespaceId] || 0) + 1;
    });

    return {
      total: items.length,
      byNamespace,
    };
  }

  /**
   * Collects deployment counts (total)
   * 
   * @returns Promise resolving to deployment counts
   */
  private async collectDeploymentCounts(): Promise<{ total: number }> {
    const deploymentList = await this.kubernetesClient.appsApi.listDeploymentForAllNamespaces();
    const items = deploymentList.items || [];

    return {
      total: items.length,
    };
  }

  /**
   * Collects statefulSet counts (total)
   * 
   * @returns Promise resolving to statefulSet counts
   */
  private async collectStatefulSetCounts(): Promise<{ total: number }> {
    const statefulSetList = await this.kubernetesClient.appsApi.listStatefulSetForAllNamespaces();
    const items = statefulSetList.items || [];

    return {
      total: items.length,
    };
  }

  /**
   * Collects replicaSet counts (total)
   * 
   * @returns Promise resolving to replicaSet counts
   */
  private async collectReplicaSetCounts(): Promise<{ total: number }> {
    const replicaSetList = await this.kubernetesClient.appsApi.listReplicaSetForAllNamespaces();
    const items = replicaSetList.items || [];

    return {
      total: items.length,
    };
  }

  /**
   * Collects service counts (total and by type)
   * 
   * @returns Promise resolving to service counts with total and byType breakdown
   */
  private async collectServiceCounts(): Promise<{
    total: number;
    byType: {
      ClusterIP?: number;
      NodePort?: number;
      LoadBalancer?: number;
      ExternalName?: number;
    };
  }> {
    const serviceList = await this.kubernetesClient.coreApi.listServiceForAllNamespaces();
    const items = serviceList.items || [];

    const byType: {
      ClusterIP?: number;
      NodePort?: number;
      LoadBalancer?: number;
      ExternalName?: number;
    } = {};

    items.forEach((service: k8s.V1Service) => {
      const type = (service.spec?.type || 'ClusterIP') as keyof typeof byType;
      if (type === 'ClusterIP' || type === 'NodePort' || type === 'LoadBalancer' || type === 'ExternalName') {
        byType[type] = (byType[type] || 0) + 1;
      }
    });

    return {
      total: items.length,
      byType,
    };
  }
}

