/**
 * Resource configuration patterns collector implementation
 * 
 * Collects resource configuration patterns including resource limits/requests,
 * replica counts, security contexts, volumes, services, and probes
 * on a 12-hour interval.
 */

import { randomBytes } from 'crypto';
import * as k8s from '@kubernetes/client-node';
import type {
  ResourceLimitsRequestsData,
  ReplicaCountsData,
  ImagePullPoliciesData,
  SecurityContextsData,
  LabelsAnnotationsData,
  VolumesData,
  ServicesData,
  ProbesData,
  ProbeConfigData,
  ResourceConfigurationPatternsData,
  CollectionPayload,
} from '../types.js';
import { validateResourceConfigurationPatterns } from '../validation.js';
import { LocalStorage } from '../storage.js';
import { TransmissionClient } from '../transmission.js';
import { KubernetesClient } from '../../kubernetes/client.js';
import { generateClusterIdForCollection } from '../../cluster/identifier.js';
import type { Config } from '../../config/types.js';
import { logger } from '../../logging/logger.js';

/**
 * Initializes an empty ResourceLimitsRequestsData structure
 * 
 * @returns Empty resource limits and requests data structure
 */
export function initResourceLimitsRequestsData(): ResourceLimitsRequestsData {
  return {
    containers: {
      cpuRequests: [],
      cpuLimits: [],
      memoryRequests: [],
      memoryLimits: [],
      totalCount: 0,
    },
  };
}

/**
 * Initializes an empty ReplicaCountsData structure
 * 
 * @returns Empty replica counts data structure
 */
export function initReplicaCountsData(): ReplicaCountsData {
  return {
    deployments: [],
    statefulSets: [],
    daemonSetCount: 0,
  };
}

/**
 * Initializes an empty ImagePullPoliciesData structure
 * 
 * @returns Empty image pull policies data structure
 */
export function initImagePullPoliciesData(): ImagePullPoliciesData {
  return {
    policies: {
      Always: 0,
      IfNotPresent: 0,
      Never: 0,
      notSet: 0,
    },
    totalContainers: 0,
  };
}

/**
 * Initializes an empty SecurityContextsData structure
 * 
 * @returns Empty security contexts data structure
 */
export function initSecurityContextsData(): SecurityContextsData {
  return {
    podLevel: {
      runAsNonRoot: {
        true: 0,
        false: 0,
        notSet: 0,
      },
      fsGroup: {
        set: 0,
        notSet: 0,
      },
    },
    containerLevel: {
      runAsNonRoot: {
        true: 0,
        false: 0,
        notSet: 0,
      },
      readOnlyRootFilesystem: {
        true: 0,
        false: 0,
        notSet: 0,
      },
      allowPrivilegeEscalation: {
        true: 0,
        false: 0,
        notSet: 0,
      },
      capabilities: {
        added: [],
        dropped: [],
      },
    },
    totalPods: 0,
    totalContainers: 0,
  };
}

/**
 * Initializes an empty LabelsAnnotationsData structure
 * 
 * @returns Empty labels and annotations data structure
 */
export function initLabelsAnnotationsData(): LabelsAnnotationsData {
  return {
    labelCounts: {
      pods: [],
      deployments: [],
      services: [],
    },
    annotationCounts: {
      pods: [],
      deployments: [],
      services: [],
    },
    commonLabelKeys: [],
  };
}

/**
 * Initializes an empty VolumesData structure
 * 
 * @returns Empty volumes data structure
 */
export function initVolumesData(): VolumesData {
  return {
    volumeTypes: {
      configMap: 0,
      secret: 0,
      emptyDir: 0,
      persistentVolumeClaim: 0,
      hostPath: 0,
      downwardAPI: 0,
      projected: 0,
      other: 0,
    },
    volumesPerPod: [],
    volumeMountsPerContainer: [],
    totalPods: 0,
  };
}

/**
 * Initializes an empty ServicesData structure
 * 
 * @returns Empty services data structure
 */
export function initServicesData(): ServicesData {
  return {
    serviceTypes: {
      ClusterIP: 0,
      NodePort: 0,
      LoadBalancer: 0,
      ExternalName: 0,
    },
    portsPerService: [],
    totalServices: 0,
  };
}

/**
 * Initializes an empty ProbeConfigData structure
 * 
 * @returns Empty probe configuration data structure
 */
export function initProbeConfigData(): ProbeConfigData {
  return {
    configured: 0,
    notConfigured: 0,
    probeTypes: {
      http: 0,
      tcp: 0,
      exec: 0,
      grpc: 0,
    },
    initialDelaySeconds: [],
    timeoutSeconds: [],
    periodSeconds: [],
  };
}

/**
 * Initializes an empty ProbesData structure
 * 
 * @returns Empty probes data structure
 */
export function initProbesData(): ProbesData {
  return {
    livenessProbes: initProbeConfigData(),
    readinessProbes: initProbeConfigData(),
    startupProbes: initProbeConfigData(),
    totalContainers: 0,
  };
}

/**
 * Processes container resource limits and requests
 * 
 * @param data - Resource configuration patterns data to update
 * @param containerResources - Container resources from Kubernetes API
 */
export function processContainerResources(
  data: ResourceConfigurationPatternsData,
  containerResources: k8s.V1ResourceRequirements | undefined
): void {
  // Extract CPU and memory requests
  const cpuRequest = containerResources?.requests?.cpu ?? null;
  const memoryRequest = containerResources?.requests?.memory ?? null;
  
  // Extract CPU and memory limits
  const cpuLimit = containerResources?.limits?.cpu ?? null;
  const memoryLimit = containerResources?.limits?.memory ?? null;
  
  // Push values to arrays (as strings or null)
  data.resourceLimitsRequests.containers.cpuRequests.push(cpuRequest);
  data.resourceLimitsRequests.containers.memoryRequests.push(memoryRequest);
  data.resourceLimitsRequests.containers.cpuLimits.push(cpuLimit);
  data.resourceLimitsRequests.containers.memoryLimits.push(memoryLimit);
  
  // Increment total count
  data.resourceLimitsRequests.containers.totalCount++;
}

/**
 * Processes image pull policy from a container
 * 
 * @param data - Resource configuration patterns data to update
 * @param imagePullPolicy - Image pull policy from container spec
 */
export function processImagePullPolicy(
  data: ResourceConfigurationPatternsData,
  imagePullPolicy: string | undefined
): void {
  // Increment appropriate counter based on policy
  if (imagePullPolicy === 'Always') {
    data.imagePullPolicies.policies.Always++;
  } else if (imagePullPolicy === 'IfNotPresent') {
    data.imagePullPolicies.policies.IfNotPresent++;
  } else if (imagePullPolicy === 'Never') {
    data.imagePullPolicies.policies.Never++;
  } else {
    data.imagePullPolicies.policies.notSet++;
  }
  
  // Increment total containers
  data.imagePullPolicies.totalContainers++;
}

/**
 * Processes container-level security context
 * 
 * @param data - Resource configuration patterns data to update
 * @param securityContext - Container security context from Kubernetes API
 */
export function processContainerSecurityContext(
  data: ResourceConfigurationPatternsData,
  securityContext: k8s.V1SecurityContext | undefined
): void {
  // Track runAsNonRoot
  if (securityContext?.runAsNonRoot === true) {
    data.securityContexts.containerLevel.runAsNonRoot.true++;
  } else if (securityContext?.runAsNonRoot === false) {
    data.securityContexts.containerLevel.runAsNonRoot.false++;
  } else {
    data.securityContexts.containerLevel.runAsNonRoot.notSet++;
  }
  
  // Track readOnlyRootFilesystem
  if (securityContext?.readOnlyRootFilesystem === true) {
    data.securityContexts.containerLevel.readOnlyRootFilesystem.true++;
  } else if (securityContext?.readOnlyRootFilesystem === false) {
    data.securityContexts.containerLevel.readOnlyRootFilesystem.false++;
  } else {
    data.securityContexts.containerLevel.readOnlyRootFilesystem.notSet++;
  }
  
  // Track allowPrivilegeEscalation
  if (securityContext?.allowPrivilegeEscalation === true) {
    data.securityContexts.containerLevel.allowPrivilegeEscalation.true++;
  } else if (securityContext?.allowPrivilegeEscalation === false) {
    data.securityContexts.containerLevel.allowPrivilegeEscalation.false++;
  } else {
    data.securityContexts.containerLevel.allowPrivilegeEscalation.notSet++;
  }
  
  // Track capabilities
  if (securityContext?.capabilities?.add) {
    data.securityContexts.containerLevel.capabilities.added.push(...securityContext.capabilities.add);
  }
  if (securityContext?.capabilities?.drop) {
    data.securityContexts.containerLevel.capabilities.dropped.push(...securityContext.capabilities.drop);
  }
  
  // Increment total containers
  data.securityContexts.totalContainers++;
}

/**
 * Processes pod-level security context
 * 
 * @param data - Resource configuration patterns data to update
 * @param securityContext - Pod security context from Kubernetes API
 */
export function processPodSecurityContext(
  data: ResourceConfigurationPatternsData,
  securityContext: k8s.V1PodSecurityContext | undefined
): void {
  // Track runAsNonRoot
  if (securityContext?.runAsNonRoot === true) {
    data.securityContexts.podLevel.runAsNonRoot.true++;
  } else if (securityContext?.runAsNonRoot === false) {
    data.securityContexts.podLevel.runAsNonRoot.false++;
  } else {
    data.securityContexts.podLevel.runAsNonRoot.notSet++;
  }
  
  // Track fsGroup
  if (securityContext?.fsGroup !== undefined) {
    data.securityContexts.podLevel.fsGroup.set++;
  } else {
    data.securityContexts.podLevel.fsGroup.notSet++;
  }
  
  // Increment total pods
  data.securityContexts.totalPods++;
}

/**
 * Processes a single probe configuration
 * 
 * @param probeConfig - Probe configuration data to update
 * @param probe - Probe from Kubernetes API
 */
function processProbe(
  probeConfig: ProbeConfigData,
  probe: k8s.V1Probe | undefined
): void {
  if (!probe) {
    probeConfig.notConfigured++;
    return;
  }
  
  probeConfig.configured++;
  
  // Determine probe type
  if (probe.httpGet) {
    probeConfig.probeTypes.http++;
  } else if (probe.tcpSocket) {
    probeConfig.probeTypes.tcp++;
  } else if (probe.exec) {
    probeConfig.probeTypes.exec++;
  } else if (probe.grpc) {
    probeConfig.probeTypes.grpc++;
  }
  
  // Extract timing configurations
  if (probe.initialDelaySeconds !== undefined) {
    probeConfig.initialDelaySeconds.push(probe.initialDelaySeconds);
  }
  if (probe.timeoutSeconds !== undefined) {
    probeConfig.timeoutSeconds.push(probe.timeoutSeconds);
  }
  if (probe.periodSeconds !== undefined) {
    probeConfig.periodSeconds.push(probe.periodSeconds);
  }
}

/**
 * Processes probes from a container
 * 
 * @param data - Resource configuration patterns data to update
 * @param container - Container from Kubernetes API
 */
export function processProbes(
  data: ResourceConfigurationPatternsData,
  container: k8s.V1Container
): void {
  // Process each probe type
  processProbe(data.probes.livenessProbes, container.livenessProbe);
  processProbe(data.probes.readinessProbes, container.readinessProbe);
  processProbe(data.probes.startupProbes, container.startupProbe);
  
  // Increment total containers
  data.probes.totalContainers++;
}

/**
 * Processes volumes from a pod
 * 
 * @param data - Resource configuration patterns data to update
 * @param volumes - Volumes array from pod spec
 */
export function processVolumes(
  data: ResourceConfigurationPatternsData,
  volumes: k8s.V1Volume[] | undefined
): void {
  if (!volumes || volumes.length === 0) {
    data.volumes.volumesPerPod.push(0);
    data.volumes.totalPods++;
    return;
  }
  
  // Track volume count for this pod
  data.volumes.volumesPerPod.push(volumes.length);
  
  // Process each volume to determine type
  for (const volume of volumes) {
    if (volume.configMap) {
      data.volumes.volumeTypes.configMap++;
    } else if (volume.secret) {
      data.volumes.volumeTypes.secret++;
    } else if (volume.emptyDir) {
      data.volumes.volumeTypes.emptyDir++;
    } else if (volume.persistentVolumeClaim) {
      data.volumes.volumeTypes.persistentVolumeClaim++;
    } else if (volume.hostPath) {
      data.volumes.volumeTypes.hostPath++;
    } else if (volume.downwardAPI) {
      data.volumes.volumeTypes.downwardAPI++;
    } else if (volume.projected) {
      data.volumes.volumeTypes.projected++;
    } else {
      data.volumes.volumeTypes.other++;
    }
  }
  
  // Increment total pods
  data.volumes.totalPods++;
}

/**
 * Processes labels and annotations from pod metadata
 * 
 * @param data - Resource configuration patterns data to update
 * @param metadata - Pod metadata from Kubernetes API
 */
export function processPodLabelsAnnotations(
  data: ResourceConfigurationPatternsData,
  metadata: k8s.V1ObjectMeta | undefined
): void {
  // Count labels
  const labelCount = Object.keys(metadata?.labels || {}).length;
  data.labelsAnnotations.labelCounts.pods.push(labelCount);
  
  // Count annotations
  const annotationCount = Object.keys(metadata?.annotations || {}).length;
  data.labelsAnnotations.annotationCounts.pods.push(annotationCount);
}

/**
 * Processes labels and annotations from deployment or service metadata
 * 
 * @param data - Resource configuration patterns data to update
 * @param resourceType - Type of resource ('deployments' or 'services')
 * @param metadata - Resource metadata from Kubernetes API
 */
export function processLabelsAnnotations(
  data: ResourceConfigurationPatternsData,
  resourceType: 'deployments' | 'services',
  metadata: k8s.V1ObjectMeta | undefined
): void {
  // Count labels
  const labelCount = Object.keys(metadata?.labels || {}).length;
  data.labelsAnnotations.labelCounts[resourceType].push(labelCount);
  
  // Count annotations
  const annotationCount = Object.keys(metadata?.annotations || {}).length;
  data.labelsAnnotations.annotationCounts[resourceType].push(annotationCount);
}

/**
 * Processes service type and port configuration
 * 
 * @param data - Resource configuration patterns data to update
 * @param serviceType - Service type from Kubernetes API
 * @param ports - Service ports from Kubernetes API
 */
export function processServiceType(
  data: ResourceConfigurationPatternsData,
  serviceType: string | undefined,
  ports: k8s.V1ServicePort[] | undefined
): void {
  // Default to ClusterIP if not specified
  const type = serviceType || 'ClusterIP';
  
  // Increment service type counter
  if (type === 'ClusterIP') {
    data.services.serviceTypes.ClusterIP++;
  } else if (type === 'NodePort') {
    data.services.serviceTypes.NodePort++;
  } else if (type === 'LoadBalancer') {
    data.services.serviceTypes.LoadBalancer++;
  } else if (type === 'ExternalName') {
    data.services.serviceTypes.ExternalName++;
  }
  
  // Record port count
  const portCount = ports?.length || 0;
  data.services.portsPerService.push(portCount);
  
  // Increment total services
  data.services.totalServices++;
}

/**
 * ResourceConfigurationPatternsCollector collects resource configuration patterns
 * and processes them through validation, storage (free tier), or transmission (pro tier).
 */
export class ResourceConfigurationPatternsCollector {
  private readonly kubernetesClient: KubernetesClient;
  private readonly localStorage: LocalStorage;
  private readonly transmissionClient: TransmissionClient | null;
  private readonly config: Config;

  /**
   * Creates a new ResourceConfigurationPatternsCollector instance
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
   * Collects resource configuration patterns from the Kubernetes API
   * 
   * @returns Promise resolving to collected resource configuration patterns data
   * @throws Error if collection fails (will be caught by scheduler)
   */
  async collect(): Promise<ResourceConfigurationPatternsData> {
    logger.info('Starting resource configuration patterns collection');

    try {
      // Initialize data structure
      const data: ResourceConfigurationPatternsData = {
        timestamp: new Date().toISOString(),
        collectionId: this.generateCollectionId(),
        clusterId: generateClusterIdForCollection(),
        resourceLimitsRequests: initResourceLimitsRequestsData(),
        replicaCounts: initReplicaCountsData(),
        imagePullPolicies: initImagePullPoliciesData(),
        securityContexts: initSecurityContextsData(),
        labelsAnnotations: initLabelsAnnotationsData(),
        volumes: initVolumesData(),
        services: initServicesData(),
        probes: initProbesData(),
      };

      // Collect from pods
      const podList = await this.kubernetesClient.coreApi.listPodForAllNamespaces();
      for (const pod of podList.body.items || []) {
        // Process pod-level data
        processPodSecurityContext(data, pod.spec?.securityContext);
        processPodLabelsAnnotations(data, pod.metadata);
        processVolumes(data, pod.spec?.volumes);

        // Process each container
        const containers = pod.spec?.containers || [];
        for (const container of containers) {
          processContainerResources(data, container.resources);
          processImagePullPolicy(data, container.imagePullPolicy);
          processContainerSecurityContext(data, container.securityContext);
          processProbes(data, container);
        }
      }

      // Collect from deployments
      const deploymentList = await this.kubernetesClient.appsApi.listDeploymentForAllNamespaces();
      for (const deployment of deploymentList.body.items || []) {
        if (deployment.spec?.replicas !== undefined) {
          data.replicaCounts.deployments.push(deployment.spec.replicas);
        }
        processLabelsAnnotations(data, 'deployments', deployment.metadata);
      }

      // Collect from statefulSets
      const statefulSetList = await this.kubernetesClient.appsApi.listStatefulSetForAllNamespaces();
      for (const statefulSet of statefulSetList.body.items || []) {
        if (statefulSet.spec?.replicas !== undefined) {
          data.replicaCounts.statefulSets.push(statefulSet.spec.replicas);
        }
      }

      // Collect from daemonSets
      const daemonSetList = await this.kubernetesClient.appsApi.listDaemonSetForAllNamespaces();
      data.replicaCounts.daemonSetCount = daemonSetList.body.items?.length || 0;

      // Collect from services
      const serviceList = await this.kubernetesClient.coreApi.listServiceForAllNamespaces();
      for (const service of serviceList.body.items || []) {
        processServiceType(data, service.spec?.type, service.spec?.ports);
        processLabelsAnnotations(data, 'services', service.metadata);
      }

      logger.info('Resource configuration patterns collected successfully', {
        collectionId: data.collectionId,
        clusterId: data.clusterId,
        totalPods: data.securityContexts.totalPods,
        totalContainers: data.securityContexts.totalContainers,
        totalServices: data.services.totalServices,
      });

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to collect resource configuration patterns', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Processes collected data: validates, wraps in payload, and stores/transmits
   * 
   * @param data - Collected resource configuration patterns data
   * @returns Promise that resolves when processing is complete
   */
  async processCollection(data: ResourceConfigurationPatternsData): Promise<void> {
    try {
      // Validate the collected data
      const validatedData = validateResourceConfigurationPatterns(data);

      // Wrap in collection payload with sanitization metadata
      const payload: CollectionPayload = {
        version: 'v1.0.0',
        type: 'resource-configuration-patterns',
        data: validatedData,
        sanitization: {
          rulesApplied: ['no-resource-names', 'aggregated-configuration-data'],
          timestamp: new Date().toISOString(),
        },
      };

      // Determine tier and process accordingly
      if (this.config.apiKey && this.transmissionClient) {
        // Pro tier: transmit to server
        logger.info('Transmitting resource configuration patterns collection (pro tier)', {
          collectionId: validatedData.collectionId,
        });
        await this.transmissionClient.transmit(payload);
      } else {
        // Free tier: store locally
        logger.info('Storing resource configuration patterns collection locally (free tier)', {
          collectionId: validatedData.collectionId,
        });
        await this.localStorage.store(payload);
      }

      logger.info('Resource configuration patterns collection processed successfully', {
        collectionId: validatedData.collectionId,
        tier: this.config.apiKey ? 'pro' : 'free',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process resource configuration patterns collection', {
        error: errorMessage,
        collectionId: data.collectionId,
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
}

