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
 * Resource limits and requests data
 */
export interface ResourceLimitsRequestsData {
  /**
   * Container resource configurations
   */
  containers: {
    /**
     * CPU request values (e.g., ["100m", "200m", "500m", null])
     */
    cpuRequests: (string | null)[];

    /**
     * CPU limit values (e.g., ["1000m", "2000m", null])
     */
    cpuLimits: (string | null)[];

    /**
     * Memory request values (e.g., ["128Mi", "256Mi", null])
     */
    memoryRequests: (string | null)[];

    /**
     * Memory limit values (e.g., ["512Mi", "1Gi", null])
     */
    memoryLimits: (string | null)[];

    /**
     * Total containers examined
     */
    totalCount: number;
  };
}

/**
 * Replica counts data
 */
export interface ReplicaCountsData {
  /**
   * List of replica counts from deployments
   */
  deployments: number[];

  /**
   * List of replica counts from statefulSets
   */
  statefulSets: number[];

  /**
   * Count of daemonSets (no replicas)
   */
  daemonSetCount: number;
}

/**
 * Image pull policies data
 */
export interface ImagePullPoliciesData {
  /**
   * Distribution of image pull policies
   */
  policies: {
    /**
     * Count of Always policy
     */
    Always: number;

    /**
     * Count of IfNotPresent policy
     */
    IfNotPresent: number;

    /**
     * Count of Never policy
     */
    Never: number;

    /**
     * Count when not set
     */
    notSet: number;
  };

  /**
   * Total containers examined
   */
  totalContainers: number;
}

/**
 * Security contexts data
 */
export interface SecurityContextsData {
  /**
   * Pod-level security context settings
   */
  podLevel: {
    /**
     * runAsNonRoot setting distribution
     */
    runAsNonRoot: {
      true: number;
      false: number;
      notSet: number;
    };

    /**
     * fsGroup setting distribution
     */
    fsGroup: {
      set: number;
      notSet: number;
    };
  };

  /**
   * Container-level security context settings
   */
  containerLevel: {
    /**
     * runAsNonRoot setting distribution
     */
    runAsNonRoot: {
      true: number;
      false: number;
      notSet: number;
    };

    /**
     * readOnlyRootFilesystem setting distribution
     */
    readOnlyRootFilesystem: {
      true: number;
      false: number;
      notSet: number;
    };

    /**
     * allowPrivilegeEscalation setting distribution
     */
    allowPrivilegeEscalation: {
      true: number;
      false: number;
      notSet: number;
    };

    /**
     * Capabilities added and dropped
     */
    capabilities: {
      /**
       * List of capabilities added (e.g., ["NET_ADMIN", "SYS_TIME"])
       */
      added: string[];

      /**
       * List of capabilities dropped (e.g., ["ALL"])
       */
      dropped: string[];
    };
  };

  /**
   * Total pods examined
   */
  totalPods: number;

  /**
   * Total containers examined
   */
  totalContainers: number;
}

/**
 * Labels and annotations data
 */
export interface LabelsAnnotationsData {
  /**
   * Count of labels per resource type
   */
  labelCounts: {
    /**
     * List of label counts per pod
     */
    pods: number[];

    /**
     * List of label counts per deployment
     */
    deployments: number[];

    /**
     * List of label counts per service
     */
    services: number[];
  };

  /**
   * Count of annotations per resource type
   */
  annotationCounts: {
    /**
     * List of annotation counts per pod
     */
    pods: number[];

    /**
     * List of annotation counts per deployment
     */
    deployments: number[];

    /**
     * List of annotation counts per service
     */
    services: number[];
  };

  /**
   * Common label keys found (without values)
   * e.g., ["app", "version", "component"]
   */
  commonLabelKeys: string[];
}

/**
 * Volumes data
 */
export interface VolumesData {
  /**
   * Volume types used across cluster
   */
  volumeTypes: {
    configMap: number;
    secret: number;
    emptyDir: number;
    persistentVolumeClaim: number;
    hostPath: number;
    downwardAPI: number;
    projected: number;
    other: number;
  };

  /**
   * Volume counts per pod
   */
  volumesPerPod: number[];

  /**
   * Volume mount counts per container
   */
  volumeMountsPerContainer: number[];

  /**
   * Total pods examined
   */
  totalPods: number;
}

/**
 * Services data
 */
export interface ServicesData {
  /**
   * Service type distribution
   */
  serviceTypes: {
    ClusterIP: number;
    NodePort: number;
    LoadBalancer: number;
    ExternalName: number;
  };

  /**
   * Port counts per service
   */
  portsPerService: number[];

  /**
   * Total services examined
   */
  totalServices: number;
}

/**
 * Probe configuration data
 */
export interface ProbeConfigData {
  /**
   * Count with probe configured
   */
  configured: number;

  /**
   * Count without probe configured
   */
  notConfigured: number;

  /**
   * Probe types distribution
   */
  probeTypes: {
    http: number;
    tcp: number;
    exec: number;
    grpc: number;
  };

  /**
   * List of initialDelaySeconds values
   */
  initialDelaySeconds: number[];

  /**
   * List of timeoutSeconds values
   */
  timeoutSeconds: number[];

  /**
   * List of periodSeconds values
   */
  periodSeconds: number[];
}

/**
 * Probes data
 */
export interface ProbesData {
  /**
   * Liveness probe configurations
   */
  livenessProbes: ProbeConfigData;

  /**
   * Readiness probe configurations
   */
  readinessProbes: ProbeConfigData;

  /**
   * Startup probe configurations
   */
  startupProbes: ProbeConfigData;

  /**
   * Total containers examined
   */
  totalContainers: number;
}

/**
 * Resource configuration patterns collection data
 */
export interface ResourceConfigurationPatternsData {
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
   * Resource limits and requests
   */
  resourceLimitsRequests: ResourceLimitsRequestsData;

  /**
   * Replica configurations
   */
  replicaCounts: ReplicaCountsData;

  /**
   * Image pull policies
   */
  imagePullPolicies: ImagePullPoliciesData;

  /**
   * Security contexts
   */
  securityContexts: SecurityContextsData;

  /**
   * Labels and annotations
   */
  labelsAnnotations: LabelsAnnotationsData;

  /**
   * Volume configurations
   */
  volumes: VolumesData;

  /**
   * Service configurations
   */
  services: ServicesData;

  /**
   * Probe configurations
   */
  probes: ProbesData;
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
  type: "cluster-metadata" | "resource-inventory" | "resource-configuration-patterns";

  /**
   * Collection data (type-specific)
   */
  data: ClusterMetadata | ResourceInventory | ResourceConfigurationPatternsData;

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

