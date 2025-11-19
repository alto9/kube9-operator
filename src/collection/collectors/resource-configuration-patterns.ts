/**
 * Resource configuration patterns collector implementation
 * 
 * Collects resource configuration patterns including resource limits/requests,
 * replica counts, security contexts, volumes, services, and probes
 * on a 12-hour interval.
 */

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
} from '../types.js';

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

