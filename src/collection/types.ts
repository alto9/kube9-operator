/**
 * TypeScript interfaces for collection data structures
 * These interfaces match the schemas defined in the specs exactly.
 */

/**
 * Cluster metadata collection data
 */
export interface ClusterMetadata {
  /**
   * ISO 8601 timestamp of collection
   */
  timestamp: string;

  /**
   * Unique identifier for this collection
   * Format: "coll_[a-z0-9]{32}"
   */
  collectionId: string;

  /**
   * Server-assigned cluster identifier (or locally generated)
   * Format: "cls_[a-z0-9]{32}"
   */
  clusterId: string;

  /**
   * Kubernetes version (e.g., "1.28.0")
   * Pattern: "^v?\\d+\\.\\d+\\.\\d+"
   */
  kubernetesVersion: string;

  /**
   * Approximate number of nodes
   * Integer, minimum: 1, maximum: 10000
   */
  nodeCount: number;

  /**
   * Cluster provider/cloud (optional)
   */
  provider?: "aws" | "gcp" | "azure" | "on-premise" | "other" | "unknown";

  /**
   * Cluster region (optional)
   * Max length: 50 characters
   */
  region?: string;

  /**
   * Cluster zone/availability zone (optional)
   * Max length: 50 characters
   */
  zone?: string;
}

/**
 * Resource inventory collection data
 */
export interface ResourceInventory {
  /**
   * ISO 8601 timestamp of collection
   */
  timestamp: string;

  /**
   * Unique identifier for this collection
   * Format: "coll_[a-z0-9]{32}"
   */
  collectionId: string;

  /**
   * Server-assigned cluster identifier (or locally generated)
   * Format: "cls_[a-z0-9]{32}"
   */
  clusterId: string;

  /**
   * Namespace information
   */
  namespaces: {
    /**
     * Integer, minimum: 0
     */
    count: number;

    /**
     * Array of hashed namespace identifiers: "namespace-[12-char-hash]"
     */
    list: string[];
  };

  /**
   * Resource counts
   */
  resources: {
    pods: {
      /**
       * Integer, minimum: 0
       */
      total: number;

      /**
       * Key: hashed namespace, Value: pod count
       */
      byNamespace: Record<string, number>;
    };
    deployments: {
      /**
       * Integer, minimum: 0
       */
      total: number;
    };
    statefulSets: {
      /**
       * Integer, minimum: 0
       */
      total: number;
    };
    replicaSets: {
      /**
       * Integer, minimum: 0
       */
      total: number;
    };
    services: {
      /**
       * Integer, minimum: 0
       */
      total: number;

      /**
       * Service counts by type
       */
      byType: {
        ClusterIP?: number;
        NodePort?: number;
        LoadBalancer?: number;
        ExternalName?: number;
      };
    };
  };
}

/**
 * Collection payload wrapper for all collection types
 */
export interface CollectionPayload {
  /**
   * Schema version (e.g., "v1.0.0")
   */
  version: string;

  /**
   * Collection type identifier
   */
  type: "cluster-metadata" | "resource-inventory";

  /**
   * Collection data (type-specific)
   */
  data: ClusterMetadata | ResourceInventory;

  /**
   * Sanitization metadata
   */
  sanitization: {
    /**
     * List of sanitization rules applied
     */
    rulesApplied: string[];

    /**
     * ISO 8601 timestamp of sanitization
     */
    timestamp: string;
  };
}

