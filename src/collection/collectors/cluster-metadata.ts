/**
 * Cluster metadata collector implementation
 * 
 * Collects Kubernetes cluster metadata including version, cluster identifier,
 * node count, provider, and region/zone information on a 24-hour interval.
 */

import { randomBytes } from 'crypto';
import * as k8s from '@kubernetes/client-node';
import type { ClusterMetadata, CollectionPayload } from '../types.js';
import { validateClusterMetadata } from '../validation.js';
import { LocalStorage } from '../storage.js';
import { TransmissionClient } from '../transmission.js';
import { KubernetesClient } from '../../kubernetes/client.js';
import { generateClusterIdForCollection } from '../../cluster/identifier.js';
import type { Config } from '../../config/types.js';
import { logger } from '../../logging/logger.js';

/**
 * ClusterMetadataCollector collects cluster metadata and processes it
 * through validation, local storage, or optional transmission.
 */
export class ClusterMetadataCollector {
  private readonly kubernetesClient: KubernetesClient;
  private readonly localStorage: LocalStorage;
  private readonly transmissionClient: TransmissionClient | null;
  private readonly config: Config;

  /**
   * Creates a new ClusterMetadataCollector instance
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
   * Collects cluster metadata from the Kubernetes API
   * 
   * @returns Promise resolving to collected cluster metadata
   * @throws Error if collection fails (will be caught by scheduler)
   */
  async collect(): Promise<ClusterMetadata> {
    logger.info('Starting cluster metadata collection');

    try {
      // Get Kubernetes version
      const versionInfo = await this.kubernetesClient.versionApi.getCode();
      const gitVersion = versionInfo.gitVersion || 'unknown';
      // Strip 'v' prefix if present
      const kubernetesVersion = gitVersion.startsWith('v') ? gitVersion.substring(1) : gitVersion;

      // Generate cluster identifier
      const clusterId = generateClusterIdForCollection();

      // Get node list for counting and metadata extraction
      const nodeList = await this.kubernetesClient.coreApi.listNode();
      const nodeCount = nodeList.items?.length || 0;

      // Detect provider from node labels
      const provider = this.detectProvider(nodeList);

      // Extract region and zone from node labels
      const { region, zone } = this.extractRegionAndZone(nodeList);

      // Generate collection ID
      const collectionId = this.generateCollectionId();

      // Create ISO 8601 timestamp
      const timestamp = new Date().toISOString();

      const metadata: ClusterMetadata = {
        timestamp,
        collectionId,
        clusterId,
        kubernetesVersion,
        nodeCount,
        provider,
        region,
        zone,
      };

      logger.info('Cluster metadata collected successfully', {
        collectionId,
        clusterId,
        kubernetesVersion,
        nodeCount,
        provider,
        region,
        zone,
      });

      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to collect cluster metadata', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Processes collected metadata: validates, wraps in payload, and stores/transmits
   * 
   * @param metadata - Collected cluster metadata
   * @returns Promise that resolves when processing is complete
   */
  async processCollection(metadata: ClusterMetadata): Promise<void> {
    try {
      // Validate the collected data
      const validatedMetadata = validateClusterMetadata(metadata);

      // Wrap in collection payload with sanitization metadata
      const payload: CollectionPayload = {
        version: 'v1.0.0',
        type: 'cluster-metadata',
        data: validatedMetadata,
        sanitization: {
          rulesApplied: ['no-resource-names', 'hashed-cluster-id'],
          timestamp: new Date().toISOString(),
        },
      };

      if (this.transmissionClient) {
        logger.info('Transmitting cluster metadata collection', {
          collectionId: validatedMetadata.collectionId,
        });
        await this.transmissionClient.transmit(payload);
      } else {
        logger.info('Storing cluster metadata collection locally', {
          collectionId: validatedMetadata.collectionId,
        });
        await this.localStorage.store(payload);
      }

      logger.info('Cluster metadata collection processed successfully', {
        collectionId: validatedMetadata.collectionId,
        transmitted: this.transmissionClient !== null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process cluster metadata collection', {
        error: errorMessage,
        collectionId: metadata.collectionId,
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
   * Detects cloud provider from node labels
   * 
   * @param nodeList - Kubernetes node list response
   * @returns Provider identifier or "unknown"
   */
  private detectProvider(nodeList: k8s.V1NodeList): ClusterMetadata['provider'] {
    if (!nodeList.items || nodeList.items.length === 0) {
      return 'unknown';
    }

    const firstNode = nodeList.items[0];
    const labels = firstNode.metadata?.labels || {};

    // Check for AWS/EKS indicators
    if (
      labels['eks.amazonaws.com/nodegroup'] ||
      (labels['kubernetes.io/instance-type'] && labels['kubernetes.io/instance-type'].includes('t3'))
    ) {
      return 'aws';
    }

    // Check for GCP/GKE indicators
    if (
      labels['cloud.google.com/gke-nodepool'] ||
      labels['cloud.google.com/gke-os-distribution']
    ) {
      return 'gcp';
    }

    // Check for Azure/AKS indicators
    if (
      labels['kubernetes.azure.com/agentpool'] ||
      labels['kubernetes.io/role']
    ) {
      return 'azure';
    }

    // Check for on-premise indicators (control plane nodes often indicate on-premise)
    if (
      labels['node-role.kubernetes.io/master'] ||
      labels['node-role.kubernetes.io/control-plane']
    ) {
      return 'on-premise';
    }

    return 'unknown';
  }

  /**
   * Extracts region and zone from node labels
   * 
   * @param nodeList - Kubernetes node list response
   * @returns Object with optional region and zone strings
   */
  private extractRegionAndZone(nodeList: k8s.V1NodeList): { region?: string; zone?: string } {
    if (!nodeList.items || nodeList.items.length === 0) {
      return {};
    }

    const firstNode = nodeList.items[0];
    const labels = firstNode.metadata?.labels || {};

    // Try modern topology labels first
    let region = labels['topology.kubernetes.io/region'] ||
                 labels['failure-domain.beta.kubernetes.io/region'];

    let zone = labels['topology.kubernetes.io/zone'] ||
               labels['topology.gke.io/zone'] ||
               labels['failure-domain.beta.kubernetes.io/zone'];

    // Truncate to max 50 characters if needed
    if (region && region.length > 50) {
      region = region.substring(0, 50);
    }
    if (zone && zone.length > 50) {
      zone = zone.substring(0, 50);
    }

    return {
      region: region || undefined,
      zone: zone || undefined,
    };
  }
}

