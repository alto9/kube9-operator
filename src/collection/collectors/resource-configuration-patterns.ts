/**
 * Resource configuration patterns collector implementation
 * 
 * Collects resource configuration patterns including resource limits/requests,
 * replica counts, security contexts, volumes, services, and probes
 * on a 12-hour interval.
 */

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

