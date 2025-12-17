import { describe, it, expect } from 'vitest';

import type { ResourceConfigurationPatternsData } from '../types.js';
import {
  initResourceLimitsRequestsData,
  initReplicaCountsData,
  initImagePullPoliciesData,
  initSecurityContextsData,
  initLabelsAnnotationsData,
  initVolumesData,
  initServicesData,
  initProbeConfigData,
  initProbesData,
  processContainerResources,
  processImagePullPolicy,
  processContainerSecurityContext,
  processPodSecurityContext,
  processProbes,
  processVolumes,
  processPodLabelsAnnotations,
  processLabelsAnnotations,
  processServiceType,
  ResourceConfigurationPatternsCollector,
} from './resource-configuration-patterns.js';

// Helper function to create a full ResourceConfigurationPatternsData structure for testing
function createTestData(): ResourceConfigurationPatternsData {
  return {
    timestamp: new Date().toISOString(),
    collectionId: 'coll_test123',
    clusterId: 'cls_test456',
    resourceLimitsRequests: initResourceLimitsRequestsData(),
    replicaCounts: initReplicaCountsData(),
    imagePullPolicies: initImagePullPoliciesData(),
    securityContexts: initSecurityContextsData(),
    labelsAnnotations: initLabelsAnnotationsData(),
    volumes: initVolumesData(),
    services: initServicesData(),
    probes: initProbesData(),
  };
}

it('initResourceLimitsRequestsData - returns proper structure', () => {
  const data = initResourceLimitsRequestsData();
  
  // Verify structure
  expect(data.containers).toBeTruthy();
  expect(Array.isArray(data.containers.cpuRequests)).toBeTruthy();
  expect(Array.isArray(data.containers.cpuLimits)).toBeTruthy();
  expect(Array.isArray(data.containers.memoryRequests)).toBeTruthy();
  expect(Array.isArray(data.containers.memoryLimits)).toBeTruthy();
  expect(typeof data.containers.totalCount).toBe('number');
});

it('initResourceLimitsRequestsData - all arrays are empty', () => {
  const data = initResourceLimitsRequestsData();
  
  expect(data.containers.cpuRequests.length).toBe(0);
  expect(data.containers.cpuLimits.length).toBe(0);
  expect(data.containers.memoryRequests.length).toBe(0);
  expect(data.containers.memoryLimits.length).toBe(0);
});

it('initResourceLimitsRequestsData - totalCount is zero', () => {
  const data = initResourceLimitsRequestsData();
  
  expect(data.containers.totalCount).toBe(0);
});

it('initReplicaCountsData - returns proper structure', () => {
  const data = initReplicaCountsData();
  
  expect(Array.isArray(data.deployments)).toBeTruthy();
  expect(Array.isArray(data.statefulSets)).toBeTruthy();
  expect(typeof data.daemonSetCount).toBe('number');
});

it('initReplicaCountsData - all arrays are empty and count is zero', () => {
  const data = initReplicaCountsData();
  
  expect(data.deployments.length).toBe(0);
  expect(data.statefulSets.length).toBe(0);
  expect(data.daemonSetCount).toBe(0);
});

it('initImagePullPoliciesData - returns proper structure', () => {
  const data = initImagePullPoliciesData();
  
  expect(data.policies).toBeTruthy();
  expect(typeof data.policies.Always).toBe('number');
  expect(typeof data.policies.IfNotPresent).toBe('number');
  expect(typeof data.policies.Never).toBe('number');
  expect(typeof data.policies.notSet).toBe('number');
  expect(typeof data.totalContainers).toBe('number');
});

it('initImagePullPoliciesData - all counts are zero', () => {
  const data = initImagePullPoliciesData();
  
  expect(data.policies.Always).toBe(0);
  expect(data.policies.IfNotPresent).toBe(0);
  expect(data.policies.Never).toBe(0);
  expect(data.policies.notSet).toBe(0);
  expect(data.totalContainers).toBe(0);
});

it('initSecurityContextsData - returns proper structure', () => {
  const data = initSecurityContextsData();
  
  // Pod level
  expect(data.podLevel).toBeTruthy(); // Should have podLevel object');
  expect(data.podLevel.runAsNonRoot).toBeTruthy(); // Should have podLevel.runAsNonRoot object');
  expect(data.podLevel.fsGroup).toBeTruthy(); // Should have podLevel.fsGroup object');
  
  // Container level
  expect(data.containerLevel).toBeTruthy(); // Should have containerLevel object');
  expect(data.containerLevel.runAsNonRoot).toBeTruthy(); // Should have containerLevel.runAsNonRoot object');
  expect(data.containerLevel.readOnlyRootFilesystem).toBeTruthy(); // Should have containerLevel.readOnlyRootFilesystem object');
  expect(data.containerLevel.allowPrivilegeEscalation).toBeTruthy(); // Should have containerLevel.allowPrivilegeEscalation object');
  expect(data.containerLevel.capabilities).toBeTruthy(); // Should have containerLevel.capabilities object');
  
  // Totals
  expect(typeof data.totalPods).toBe('number');
  expect(typeof data.totalContainers).toBe('number');
});

it('initSecurityContextsData - all counts are zero', () => {
  const data = initSecurityContextsData();
  
  // Pod level counts
  expect(data.podLevel.runAsNonRoot.true).toBe(0);
  expect(data.podLevel.runAsNonRoot.false).toBe(0);
  expect(data.podLevel.runAsNonRoot.notSet).toBe(0);
  expect(data.podLevel.fsGroup.set).toBe(0);
  expect(data.podLevel.fsGroup.notSet).toBe(0);
  
  // Container level counts
  expect(data.containerLevel.runAsNonRoot.true).toBe(0);
  expect(data.containerLevel.runAsNonRoot.false).toBe(0);
  expect(data.containerLevel.runAsNonRoot.notSet).toBe(0);
  expect(data.containerLevel.readOnlyRootFilesystem.true).toBe(0);
  expect(data.containerLevel.readOnlyRootFilesystem.false).toBe(0);
  expect(data.containerLevel.readOnlyRootFilesystem.notSet).toBe(0);
  expect(data.containerLevel.allowPrivilegeEscalation.true).toBe(0);
  expect(data.containerLevel.allowPrivilegeEscalation.false).toBe(0);
  expect(data.containerLevel.allowPrivilegeEscalation.notSet).toBe(0);
  
  // Totals
  expect(data.totalPods).toBe(0);
  expect(data.totalContainers).toBe(0);
});

it('initSecurityContextsData - capabilities arrays are empty', () => {
  const data = initSecurityContextsData();
  
  expect(Array.isArray(data.containerLevel.capabilities.added), 'capabilities.added should be array');
  expect(Array.isArray(data.containerLevel.capabilities.dropped), 'capabilities.dropped should be array');
  expect(data.containerLevel.capabilities.added.length).toBe(0);
  expect(data.containerLevel.capabilities.dropped.length).toBe(0);
});

it('initLabelsAnnotationsData - returns proper structure', () => {
  const data = initLabelsAnnotationsData();
  
  expect(data.labelCounts).toBeTruthy(); // Should have labelCounts object');
  expect(Array.isArray(data.labelCounts.pods)).toBeTruthy(); // Should have labelCounts.pods array');
  expect(Array.isArray(data.labelCounts.deployments)).toBeTruthy(); // Should have labelCounts.deployments array');
  expect(Array.isArray(data.labelCounts.services)).toBeTruthy(); // Should have labelCounts.services array');
  
  expect(data.annotationCounts).toBeTruthy(); // Should have annotationCounts object');
  expect(Array.isArray(data.annotationCounts.pods)).toBeTruthy(); // Should have annotationCounts.pods array');
  expect(Array.isArray(data.annotationCounts.deployments)).toBeTruthy(); // Should have annotationCounts.deployments array');
  expect(Array.isArray(data.annotationCounts.services)).toBeTruthy(); // Should have annotationCounts.services array');
  
  expect(Array.isArray(data.commonLabelKeys)).toBeTruthy(); // Should have commonLabelKeys array');
});

it('initLabelsAnnotationsData - all arrays are empty', () => {
  const data = initLabelsAnnotationsData();
  
  expect(data.labelCounts.pods.length).toBe(0);
  expect(data.labelCounts.deployments.length).toBe(0);
  expect(data.labelCounts.services.length).toBe(0);
  
  expect(data.annotationCounts.pods.length).toBe(0);
  expect(data.annotationCounts.deployments.length).toBe(0);
  expect(data.annotationCounts.services.length).toBe(0);
  
  expect(data.commonLabelKeys.length).toBe(0);
});

it('initVolumesData - returns proper structure', () => {
  const data = initVolumesData();
  
  expect(data.volumeTypes).toBeTruthy(); // Should have volumeTypes object');
  expect(typeof data.volumeTypes.configMap).toBe('number');
  expect(typeof data.volumeTypes.secret).toBe('number');
  expect(typeof data.volumeTypes.emptyDir).toBe('number');
  expect(typeof data.volumeTypes.persistentVolumeClaim).toBe('number');
  expect(typeof data.volumeTypes.hostPath).toBe('number');
  expect(typeof data.volumeTypes.downwardAPI).toBe('number');
  expect(typeof data.volumeTypes.projected).toBe('number');
  expect(typeof data.volumeTypes.other).toBe('number');
  
  expect(Array.isArray(data.volumesPerPod)).toBeTruthy(); // Should have volumesPerPod array');
  expect(Array.isArray(data.volumeMountsPerContainer)).toBeTruthy(); // Should have volumeMountsPerContainer array');
  expect(typeof data.totalPods).toBe('number');
});

it('initVolumesData - all counts are zero and arrays are empty', () => {
  const data = initVolumesData();
  
  expect(data.volumeTypes.configMap).toBe(0);
  expect(data.volumeTypes.secret).toBe(0);
  expect(data.volumeTypes.emptyDir).toBe(0);
  expect(data.volumeTypes.persistentVolumeClaim).toBe(0);
  expect(data.volumeTypes.hostPath).toBe(0);
  expect(data.volumeTypes.downwardAPI).toBe(0);
  expect(data.volumeTypes.projected).toBe(0);
  expect(data.volumeTypes.other).toBe(0);
  
  expect(data.volumesPerPod.length).toBe(0);
  expect(data.volumeMountsPerContainer.length).toBe(0);
  expect(data.totalPods).toBe(0);
});

it('initServicesData - returns proper structure', () => {
  const data = initServicesData();
  
  expect(data.serviceTypes).toBeTruthy(); // Should have serviceTypes object');
  expect(typeof data.serviceTypes.ClusterIP).toBe('number');
  expect(typeof data.serviceTypes.NodePort).toBe('number');
  expect(typeof data.serviceTypes.LoadBalancer).toBe('number');
  expect(typeof data.serviceTypes.ExternalName).toBe('number');
  
  expect(Array.isArray(data.portsPerService)).toBeTruthy(); // Should have portsPerService array');
  expect(typeof data.totalServices).toBe('number');
});

it('initServicesData - all counts are zero and array is empty', () => {
  const data = initServicesData();
  
  expect(data.serviceTypes.ClusterIP).toBe(0);
  expect(data.serviceTypes.NodePort).toBe(0);
  expect(data.serviceTypes.LoadBalancer).toBe(0);
  expect(data.serviceTypes.ExternalName).toBe(0);
  
  expect(data.portsPerService.length).toBe(0);
  expect(data.totalServices).toBe(0);
});

it('initProbeConfigData - returns proper structure', () => {
  const data = initProbeConfigData();
  
  expect(typeof data.configured).toBe('number');
  expect(typeof data.notConfigured).toBe('number');
  
  expect(data.probeTypes).toBeTruthy(); // Should have probeTypes object');
  expect(typeof data.probeTypes.http).toBe('number');
  expect(typeof data.probeTypes.tcp).toBe('number');
  expect(typeof data.probeTypes.exec).toBe('number');
  expect(typeof data.probeTypes.grpc).toBe('number');
  
  expect(Array.isArray(data.initialDelaySeconds)).toBeTruthy(); // Should have initialDelaySeconds array');
  expect(Array.isArray(data.timeoutSeconds)).toBeTruthy(); // Should have timeoutSeconds array');
  expect(Array.isArray(data.periodSeconds)).toBeTruthy(); // Should have periodSeconds array');
});

it('initProbeConfigData - all counts are zero and arrays are empty', () => {
  const data = initProbeConfigData();
  
  expect(data.configured).toBe(0);
  expect(data.notConfigured).toBe(0);
  
  expect(data.probeTypes.http).toBe(0);
  expect(data.probeTypes.tcp).toBe(0);
  expect(data.probeTypes.exec).toBe(0);
  expect(data.probeTypes.grpc).toBe(0);
  
  expect(data.initialDelaySeconds.length).toBe(0);
  expect(data.timeoutSeconds.length).toBe(0);
  expect(data.periodSeconds.length).toBe(0);
});

it('initProbesData - returns proper structure', () => {
  const data = initProbesData();
  
  expect(data.livenessProbes).toBeTruthy(); // Should have livenessProbes object');
  expect(data.readinessProbes).toBeTruthy(); // Should have readinessProbes object');
  expect(data.startupProbes).toBeTruthy(); // Should have startupProbes object');
  expect(typeof data.totalContainers).toBe('number');
});

it('initProbesData - all probe configs are initialized', () => {
  const data = initProbesData();
  
  // Verify liveness probes initialized
  expect(data.livenessProbes.configured).toBe(0);
  expect(data.livenessProbes.notConfigured).toBe(0);
  expect(data.livenessProbes.probeTypes, 'livenessProbes should have probeTypes');
  
  // Verify readiness probes initialized
  expect(data.readinessProbes.configured).toBe(0);
  expect(data.readinessProbes.notConfigured).toBe(0);
  expect(data.readinessProbes.probeTypes, 'readinessProbes should have probeTypes');
  
  // Verify startup probes initialized
  expect(data.startupProbes.configured).toBe(0);
  expect(data.startupProbes.notConfigured).toBe(0);
  expect(data.startupProbes.probeTypes, 'startupProbes should have probeTypes');
  
  // Verify total
  expect(data.totalContainers).toBe(0);
});

it('initProbesData - probe configs have independent instances', () => {
  const data = initProbesData();
  
  // Modify one probe config
  data.livenessProbes.configured = 5;
  
  // Verify others are not affected
  expect(data.readinessProbes.configured).toBe(0);
  expect(data.startupProbes.configured).toBe(0);
});

// ========== Helper Function Tests ==========

// processContainerResources tests
it('processContainerResources - processes valid resource requests and limits', () => {
  const data = createTestData();
  
  processContainerResources(data, {
    requests: { cpu: '100m', memory: '256Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  });
  
  expect(data.resourceLimitsRequests.containers.cpuRequests.length).toBe(1);
  expect(data.resourceLimitsRequests.containers.cpuRequests[0]).toBe('100m');
  expect(data.resourceLimitsRequests.containers.memoryRequests[0]).toBe('256Mi');
  expect(data.resourceLimitsRequests.containers.cpuLimits[0]).toBe('500m');
  expect(data.resourceLimitsRequests.containers.memoryLimits[0]).toBe('512Mi');
  expect(data.resourceLimitsRequests.containers.totalCount).toBe(1);
});

it('processContainerResources - handles undefined resources', () => {
  const data = createTestData();
  
  processContainerResources(data, undefined);
  
  expect(data.resourceLimitsRequests.containers.cpuRequests[0]).toBe(null);
  expect(data.resourceLimitsRequests.containers.memoryRequests[0]).toBe(null);
  expect(data.resourceLimitsRequests.containers.cpuLimits[0]).toBe(null);
  expect(data.resourceLimitsRequests.containers.memoryLimits[0]).toBe(null);
  expect(data.resourceLimitsRequests.containers.totalCount).toBe(1);
});

it('processContainerResources - handles partial resource definitions', () => {
  const data = createTestData();
  
  processContainerResources(data, {
    requests: { cpu: '100m' },
    limits: { memory: '512Mi' },
  });
  
  expect(data.resourceLimitsRequests.containers.cpuRequests[0]).toBe('100m');
  expect(data.resourceLimitsRequests.containers.memoryRequests[0]).toBe(null);
  expect(data.resourceLimitsRequests.containers.cpuLimits[0]).toBe(null);
  expect(data.resourceLimitsRequests.containers.memoryLimits[0]).toBe('512Mi');
  expect(data.resourceLimitsRequests.containers.totalCount).toBe(1);
});

it('processContainerResources - handles multiple containers', () => {
  const data = createTestData();
  
  processContainerResources(data, { requests: { cpu: '100m' } });
  processContainerResources(data, { limits: { memory: '512Mi' } });
  processContainerResources(data, undefined);
  
  expect(data.resourceLimitsRequests.containers.totalCount).toBe(3);
  expect(data.resourceLimitsRequests.containers.cpuRequests.length).toBe(3);
});

// processImagePullPolicy tests
it('processImagePullPolicy - counts Always policy', () => {
  const data = createTestData();
  
  processImagePullPolicy(data, 'Always');
  
  expect(data.imagePullPolicies.policies.Always).toBe(1);
  expect(data.imagePullPolicies.policies.IfNotPresent).toBe(0);
  expect(data.imagePullPolicies.policies.Never).toBe(0);
  expect(data.imagePullPolicies.policies.notSet).toBe(0);
  expect(data.imagePullPolicies.totalContainers).toBe(1);
});

it('processImagePullPolicy - counts IfNotPresent policy', () => {
  const data = createTestData();
  
  processImagePullPolicy(data, 'IfNotPresent');
  
  expect(data.imagePullPolicies.policies.IfNotPresent).toBe(1);
  expect(data.imagePullPolicies.totalContainers).toBe(1);
});

it('processImagePullPolicy - counts Never policy', () => {
  const data = createTestData();
  
  processImagePullPolicy(data, 'Never');
  
  expect(data.imagePullPolicies.policies.Never).toBe(1);
  expect(data.imagePullPolicies.totalContainers).toBe(1);
});

it('processImagePullPolicy - counts notSet for undefined', () => {
  const data = createTestData();
  
  processImagePullPolicy(data, undefined);
  
  expect(data.imagePullPolicies.policies.notSet).toBe(1);
  expect(data.imagePullPolicies.totalContainers).toBe(1);
});

it('processImagePullPolicy - handles multiple containers', () => {
  const data = createTestData();
  
  processImagePullPolicy(data, 'Always');
  processImagePullPolicy(data, 'IfNotPresent');
  processImagePullPolicy(data, undefined);
  
  expect(data.imagePullPolicies.policies.Always).toBe(1);
  expect(data.imagePullPolicies.policies.IfNotPresent).toBe(1);
  expect(data.imagePullPolicies.policies.notSet).toBe(1);
  expect(data.imagePullPolicies.totalContainers).toBe(3);
});

// processContainerSecurityContext tests
it('processContainerSecurityContext - tracks all security settings', () => {
  const data = createTestData();
  
  processContainerSecurityContext(data, {
    runAsNonRoot: true,
    readOnlyRootFilesystem: false,
    allowPrivilegeEscalation: true,
    capabilities: {
      add: ['NET_ADMIN', 'SYS_TIME'],
      drop: ['ALL'],
    },
  });
  
  expect(data.securityContexts.containerLevel.runAsNonRoot.true).toBe(1);
    expect(data.securityContexts.containerLevel.readOnlyRootFilesystem.false).toBe(1);
    expect(data.securityContexts.containerLevel.allowPrivilegeEscalation.true).toBe(1);
    expect(data.securityContexts.containerLevel.capabilities.added).toEqual(['NET_ADMIN', 'SYS_TIME']);
    expect(data.securityContexts.containerLevel.capabilities.dropped).toEqual(['ALL']);
    expect(data.securityContexts.totalContainers).toBe(1);
});

it('processContainerSecurityContext - handles undefined context', () => {
  const data = createTestData();
  
  processContainerSecurityContext(data, undefined);
  
  expect(data.securityContexts.containerLevel.runAsNonRoot.notSet).toBe(1);
  expect(data.securityContexts.containerLevel.readOnlyRootFilesystem.notSet).toBe(1);
  expect(data.securityContexts.containerLevel.allowPrivilegeEscalation.notSet).toBe(1);
  expect(data.securityContexts.totalContainers).toBe(1);
});

it('processContainerSecurityContext - handles partial context', () => {
  const data = createTestData();
  
  processContainerSecurityContext(data, {
    runAsNonRoot: false,
  });
  
  expect(data.securityContexts.containerLevel.runAsNonRoot.false).toBe(1);
  expect(data.securityContexts.containerLevel.readOnlyRootFilesystem.notSet).toBe(1);
  expect(data.securityContexts.containerLevel.allowPrivilegeEscalation.notSet).toBe(1);
  expect(data.securityContexts.totalContainers).toBe(1);
});

it('processContainerSecurityContext - accumulates capabilities', () => {
  const data = createTestData();
  
  processContainerSecurityContext(data, {
    capabilities: { add: ['NET_ADMIN'] },
  });
  processContainerSecurityContext(data, {
    capabilities: { add: ['SYS_TIME'], drop: ['ALL'] },
  });
  
  expect(data.securityContexts.containerLevel.capabilities.added).toEqual(['NET_ADMIN', 'SYS_TIME']);
  expect(data.securityContexts.containerLevel.capabilities.dropped).toEqual(['ALL']);
  expect(data.securityContexts.totalContainers).toBe(2);
});

// processPodSecurityContext tests
it('processPodSecurityContext - tracks pod-level security settings', () => {
  const data = createTestData();
  
  processPodSecurityContext(data, {
    runAsNonRoot: true,
    fsGroup: 1000,
  });
  
  expect(data.securityContexts.podLevel.runAsNonRoot.true).toBe(1);
  expect(data.securityContexts.podLevel.fsGroup.set).toBe(1);
  expect(data.securityContexts.totalPods).toBe(1);
});

it('processPodSecurityContext - handles undefined context', () => {
  const data = createTestData();
  
  processPodSecurityContext(data, undefined);
  
  expect(data.securityContexts.podLevel.runAsNonRoot.notSet).toBe(1);
  expect(data.securityContexts.podLevel.fsGroup.notSet).toBe(1);
  expect(data.securityContexts.totalPods).toBe(1);
});

it('processPodSecurityContext - handles false values', () => {
  const data = createTestData();
  
  processPodSecurityContext(data, {
    runAsNonRoot: false,
  });
  
  expect(data.securityContexts.podLevel.runAsNonRoot.false).toBe(1);
  expect(data.securityContexts.podLevel.fsGroup.notSet).toBe(1);
  expect(data.securityContexts.totalPods).toBe(1);
});

it('processPodSecurityContext - handles multiple pods', () => {
  const data = createTestData();
  
  processPodSecurityContext(data, { runAsNonRoot: true, fsGroup: 1000 });
  processPodSecurityContext(data, { runAsNonRoot: false });
  processPodSecurityContext(data, undefined);
  
  expect(data.securityContexts.podLevel.runAsNonRoot.true).toBe(1);
  expect(data.securityContexts.podLevel.runAsNonRoot.false).toBe(1);
  expect(data.securityContexts.podLevel.runAsNonRoot.notSet).toBe(1);
  expect(data.securityContexts.totalPods).toBe(3);
});

// processProbes tests
it('processProbes - tracks all probe types', () => {
  const data = createTestData();
  
  processProbes(data, {
    name: 'test-container',
    image: 'test:latest',
    livenessProbe: {
      httpGet: { path: '/health', port: 8080 },
      initialDelaySeconds: 10,
      timeoutSeconds: 5,
      periodSeconds: 30,
    },
    readinessProbe: {
      tcpSocket: { port: 8080 },
      initialDelaySeconds: 5,
    },
    startupProbe: {
      exec: { command: ['cat', '/tmp/healthy'] },
      periodSeconds: 10,
    },
  });
  
  expect(data.probes.livenessProbes.configured).toBe(1);
  expect(data.probes.livenessProbes.probeTypes.http).toBe(1);
  expect(data.probes.livenessProbes.initialDelaySeconds).toEqual([10]);
  expect(data.probes.livenessProbes.timeoutSeconds).toEqual([5]);
  expect(data.probes.livenessProbes.periodSeconds).toEqual([30]);
  
  expect(data.probes.readinessProbes.configured).toBe(1);
  expect(data.probes.readinessProbes.probeTypes.tcp).toBe(1);
  
  expect(data.probes.startupProbes.configured).toBe(1);
  expect(data.probes.startupProbes.probeTypes.exec).toBe(1);
  
  expect(data.probes.totalContainers).toBe(1);
});

it('processProbes - tracks notConfigured for missing probes', () => {
  const data = createTestData();
  
  processProbes(data, {
    name: 'test-container',
    image: 'test:latest',
  });
  
  expect(data.probes.livenessProbes.notConfigured).toBe(1);
  expect(data.probes.readinessProbes.notConfigured).toBe(1);
  expect(data.probes.startupProbes.notConfigured).toBe(1);
  expect(data.probes.totalContainers).toBe(1);
});

it('processProbes - handles grpc probe type', () => {
  const data = createTestData();
  
  processProbes(data, {
    name: 'test-container',
    image: 'test:latest',
    livenessProbe: {
      grpc: { port: 9090 },
    },
  });
  
  expect(data.probes.livenessProbes.probeTypes.grpc).toBe(1);
});

it('processProbes - handles multiple containers', () => {
  const data = createTestData();
  
  processProbes(data, {
    name: 'container1',
    image: 'test:latest',
    livenessProbe: { httpGet: { path: '/health', port: 8080 } },
  });
  processProbes(data, {
    name: 'container2',
    image: 'test:latest',
  });
  
  expect(data.probes.livenessProbes.configured).toBe(1);
  expect(data.probes.livenessProbes.notConfigured).toBe(1);
  expect(data.probes.totalContainers).toBe(2);
});

// processVolumes tests
it('processVolumes - processes different volume types', () => {
  const data = createTestData();
  
  processVolumes(data, [
    { name: 'config', configMap: { name: 'my-config' } },
    { name: 'secret', secret: { secretName: 'my-secret' } },
    { name: 'empty', emptyDir: {} },
    { name: 'pvc', persistentVolumeClaim: { claimName: 'my-pvc' } },
  ]);
  
  expect(data.volumes.volumeTypes.configMap).toBe(1);
  expect(data.volumes.volumeTypes.secret).toBe(1);
  expect(data.volumes.volumeTypes.emptyDir).toBe(1);
  expect(data.volumes.volumeTypes.persistentVolumeClaim).toBe(1);
  expect(data.volumes.volumesPerPod).toEqual([4]);
  expect(data.volumes.totalPods).toBe(1);
});

it('processVolumes - handles all volume types', () => {
  const data = createTestData();
  
  processVolumes(data, [
    { name: 'hostPath', hostPath: { path: '/var/log' } },
    { name: 'downwardAPI', downwardAPI: { items: [] } },
    { name: 'projected', projected: { sources: [] } },
  ]);
  
  expect(data.volumes.volumeTypes.hostPath).toBe(1);
  expect(data.volumes.volumeTypes.downwardAPI).toBe(1);
  expect(data.volumes.volumeTypes.projected).toBe(1);
});

it('processVolumes - handles undefined volumes', () => {
  const data = createTestData();
  
  processVolumes(data, undefined);
  
  expect(data.volumes.volumesPerPod).toEqual([0]);
  expect(data.volumes.totalPods).toBe(1);
});

it('processVolumes - handles empty volumes array', () => {
  const data = createTestData();
  
  processVolumes(data, []);
  
  expect(data.volumes.volumesPerPod).toEqual([0]);
  expect(data.volumes.totalPods).toBe(1);
});

it('processVolumes - tracks other volume types', () => {
  const data = createTestData();
  
  processVolumes(data, [
    { name: 'unknown', csi: { driver: 'some-csi-driver' } },
  ]);
  
  expect(data.volumes.volumeTypes.other).toBe(1);
});

it('processVolumes - handles multiple pods', () => {
  const data = createTestData();
  
  processVolumes(data, [{ name: 'vol1', emptyDir: {} }]);
  processVolumes(data, [{ name: 'vol1', emptyDir: {} }, { name: 'vol2', emptyDir: {} }]);
  processVolumes(data, undefined);
  
  expect(data.volumes.volumesPerPod).toEqual([1, 2, 0]);
  expect(data.volumes.totalPods).toBe(3);
});

// processPodLabelsAnnotations tests
it('processPodLabelsAnnotations - counts labels and annotations', () => {
  const data = createTestData();
  
  processPodLabelsAnnotations(data, {
    labels: {
      app: 'myapp',
      version: 'v1',
      environment: 'prod',
    },
    annotations: {
      'prometheus.io/scrape': 'true',
      'prometheus.io/port': '8080',
    },
  });
  
  expect(data.labelsAnnotations.labelCounts.pods).toEqual([3]);
  expect(data.labelsAnnotations.annotationCounts.pods).toEqual([2]);
});

it('processPodLabelsAnnotations - handles undefined metadata', () => {
  const data = createTestData();
  
  processPodLabelsAnnotations(data, undefined);
  
  expect(data.labelsAnnotations.labelCounts.pods).toEqual([0]);
  expect(data.labelsAnnotations.annotationCounts.pods).toEqual([0]);
});

it('processPodLabelsAnnotations - handles empty labels and annotations', () => {
  const data = createTestData();
  
  processPodLabelsAnnotations(data, {
    labels: {},
    annotations: {},
  });
  
  expect(data.labelsAnnotations.labelCounts.pods).toEqual([0]);
  expect(data.labelsAnnotations.annotationCounts.pods).toEqual([0]);
});

it('processPodLabelsAnnotations - handles metadata without labels or annotations', () => {
  const data = createTestData();
  
  processPodLabelsAnnotations(data, {
    name: 'my-pod',
    namespace: 'default',
  });
  
  expect(data.labelsAnnotations.labelCounts.pods).toEqual([0]);
  expect(data.labelsAnnotations.annotationCounts.pods).toEqual([0]);
});

it('processPodLabelsAnnotations - handles multiple pods', () => {
  const data = createTestData();
  
  processPodLabelsAnnotations(data, {
    labels: { app: 'myapp', version: 'v1' },
    annotations: { note: 'test' },
  });
  processPodLabelsAnnotations(data, {
    labels: { app: 'otherapp' },
  });
  processPodLabelsAnnotations(data, undefined);
  
  expect(data.labelsAnnotations.labelCounts.pods).toEqual([2, 1, 0]);
  expect(data.labelsAnnotations.annotationCounts.pods).toEqual([1, 0, 0]);
});

// processLabelsAnnotations tests
it('processLabelsAnnotations - counts labels and annotations for deployments', () => {
  const data = createTestData();
  
  processLabelsAnnotations(data, 'deployments', {
    labels: {
      app: 'myapp',
      version: 'v1',
      environment: 'prod',
    },
    annotations: {
      'deployment.kubernetes.io/revision': '3',
      'kubectl.kubernetes.io/last-applied-configuration': '{}',
    },
  });
  
  expect(data.labelsAnnotations.labelCounts.deployments).toEqual([3]);
  expect(data.labelsAnnotations.annotationCounts.deployments).toEqual([2]);
});

it('processLabelsAnnotations - counts labels and annotations for services', () => {
  const data = createTestData();
  
  processLabelsAnnotations(data, 'services', {
    labels: {
      app: 'myapp',
      tier: 'backend',
    },
    annotations: {
      'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
    },
  });
  
  expect(data.labelsAnnotations.labelCounts.services).toEqual([2]);
  expect(data.labelsAnnotations.annotationCounts.services).toEqual([1]);
});

it('processLabelsAnnotations - handles undefined metadata', () => {
  const data = createTestData();
  
  processLabelsAnnotations(data, 'deployments', undefined);
  
  expect(data.labelsAnnotations.labelCounts.deployments).toEqual([0]);
  expect(data.labelsAnnotations.annotationCounts.deployments).toEqual([0]);
});

it('processLabelsAnnotations - handles empty labels and annotations', () => {
  const data = createTestData();
  
  processLabelsAnnotations(data, 'services', {
    labels: {},
    annotations: {},
  });
  
  expect(data.labelsAnnotations.labelCounts.services).toEqual([0]);
  expect(data.labelsAnnotations.annotationCounts.services).toEqual([0]);
});

it('processLabelsAnnotations - handles multiple resources', () => {
  const data = createTestData();
  
  processLabelsAnnotations(data, 'deployments', {
    labels: { app: 'app1', version: 'v1' },
    annotations: { note: 'test' },
  });
  processLabelsAnnotations(data, 'deployments', {
    labels: { app: 'app2' },
  });
  processLabelsAnnotations(data, 'services', {
    labels: { app: 'svc1', tier: 'backend', component: 'api' },
  });
  
  expect(data.labelsAnnotations.labelCounts.deployments).toEqual([2, 1]);
  expect(data.labelsAnnotations.annotationCounts.deployments).toEqual([1, 0]);
  expect(data.labelsAnnotations.labelCounts.services).toEqual([3]);
});

// processServiceType tests
it('processServiceType - counts ClusterIP service type', () => {
  const data = createTestData();
  
  processServiceType(data, 'ClusterIP', [
    { port: 80, targetPort: 8080 },
    { port: 443, targetPort: 8443 },
  ]);
  
  expect(data.services.serviceTypes.ClusterIP).toBe(1);
  expect(data.services.serviceTypes.NodePort).toBe(0);
  expect(data.services.serviceTypes.LoadBalancer).toBe(0);
  expect(data.services.serviceTypes.ExternalName).toBe(0);
  expect(data.services.portsPerService).toEqual([2]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - counts NodePort service type', () => {
  const data = createTestData();
  
  processServiceType(data, 'NodePort', [
    { port: 80, targetPort: 8080, nodePort: 30080 },
  ]);
  
  expect(data.services.serviceTypes.NodePort).toBe(1);
  expect(data.services.portsPerService).toEqual([1]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - counts LoadBalancer service type', () => {
  const data = createTestData();
  
  processServiceType(data, 'LoadBalancer', [
    { port: 443, targetPort: 8443 },
  ]);
  
  expect(data.services.serviceTypes.LoadBalancer).toBe(1);
  expect(data.services.portsPerService).toEqual([1]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - counts ExternalName service type', () => {
  const data = createTestData();
  
  processServiceType(data, 'ExternalName', undefined);
  
  expect(data.services.serviceTypes.ExternalName).toBe(1);
  expect(data.services.portsPerService).toEqual([0]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - defaults to ClusterIP when undefined', () => {
  const data = createTestData();
  
  processServiceType(data, undefined, [
    { port: 80, targetPort: 8080 },
  ]);
  
  expect(data.services.serviceTypes.ClusterIP).toBe(1);
  expect(data.services.portsPerService).toEqual([1]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - handles services with no ports', () => {
  const data = createTestData();
  
  processServiceType(data, 'ClusterIP', undefined);
  
  expect(data.services.portsPerService).toEqual([0]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - handles services with empty ports array', () => {
  const data = createTestData();
  
  processServiceType(data, 'ClusterIP', []);
  
  expect(data.services.portsPerService).toEqual([0]);
  expect(data.services.totalServices).toBe(1);
});

it('processServiceType - handles multiple services', () => {
  const data = createTestData();
  
  processServiceType(data, 'ClusterIP', [{ port: 80, targetPort: 8080 }]);
  processServiceType(data, 'NodePort', [{ port: 80, targetPort: 8080 }, { port: 443, targetPort: 8443 }]);
  processServiceType(data, 'LoadBalancer', [{ port: 443, targetPort: 8443 }]);
  processServiceType(data, undefined, undefined);
  
  expect(data.services.serviceTypes.ClusterIP).toBe(2); // One explicit, one default
  expect(data.services.serviceTypes.NodePort).toBe(1);
  expect(data.services.serviceTypes.LoadBalancer).toBe(1);
  expect(data.services.portsPerService).toEqual([1, 2, 1, 0]);
  expect(data.services.totalServices).toBe(4);
});

// ResourceConfigurationPatternsCollector tests
it('ResourceConfigurationPatternsCollector - collect() generates valid collection ID', async () => {
  // Mock KubernetesClient
  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ body: { items: [] } }),
      listServiceForAllNamespaces: async () => ({ body: { items: [] } }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ body: { items: [] } }),
      listStatefulSetForAllNamespaces: async () => ({ body: { items: [] } }),
      listDaemonSetForAllNamespaces: async () => ({ body: { items: [] } }),
    },
  };

  // Mock LocalStorage
  const mockLocalStorage = {
    store: async () => {},
  };

  // Mock Config
  const mockConfig = {
    apiKey: undefined,
  };

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();

  // Verify collectionId format
  expect(data.collectionId.startsWith('coll_')).toBeTruthy();
  expect(data.collectionId.length).toBe(37);
  expect(data.collectionId).toMatch(/^coll_[a-z0-9]{32}$/);
});

it('ResourceConfigurationPatternsCollector - collect() includes timestamp', async () => {
  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ body: { items: [] } }),
      listServiceForAllNamespaces: async () => ({ body: { items: [] } }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ body: { items: [] } }),
      listStatefulSetForAllNamespaces: async () => ({ body: { items: [] } }),
      listDaemonSetForAllNamespaces: async () => ({ body: { items: [] } }),
    },
  };

  const mockLocalStorage = { store: async () => {} };
  const mockConfig = { apiKey: undefined };

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();

  // Verify timestamp is in ISO 8601 format
  expect(data.timestamp, 'Timestamp should exist');
  const date = new Date(data.timestamp);
  expect(!isNaN(date.getTime())).toBeTruthy();
  expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

it('ResourceConfigurationPatternsCollector - collect() processes pods', async () => {
  const mockPods = [
    {
      metadata: { labels: { app: 'test' } },
      spec: {
        securityContext: { runAsNonRoot: true },
        volumes: [{ name: 'vol1', configMap: { name: 'config' } }],
        containers: [
          {
            name: 'container1',
            resources: { requests: { cpu: '100m', memory: '128Mi' } },
            imagePullPolicy: 'Always',
            securityContext: { readOnlyRootFilesystem: true },
          },
        ],
      },
    },
  ];

  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ items: mockPods }),
      listServiceForAllNamespaces: async () => ({ items: [] }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ items: [] }),
      listStatefulSetForAllNamespaces: async () => ({ items: [] }),
      listDaemonSetForAllNamespaces: async () => ({ items: [] }),
    },
  };

  const mockLocalStorage = { store: async () => {} };
  const mockConfig = { apiKey: undefined };

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();

  // Verify pod data was processed
  expect(data.securityContexts.totalPods).toBe(1);
  expect(data.securityContexts.totalContainers).toBe(1);
  expect(data.resourceLimitsRequests.containers.totalCount).toBe(1);
  expect(data.imagePullPolicies.totalContainers).toBe(1);
  expect(data.volumes.totalPods).toBe(1);
});

it('ResourceConfigurationPatternsCollector - collect() processes deployments', async () => {
  const mockDeployments = [
    {
      metadata: { labels: { app: 'test' }, annotations: { version: '1.0' } },
      spec: { replicas: 3 },
    },
    {
      metadata: { labels: { app: 'test2' } },
      spec: { replicas: 5 },
    },
  ];

  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ items: [] }),
      listServiceForAllNamespaces: async () => ({ items: [] }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ items: mockDeployments }),
      listStatefulSetForAllNamespaces: async () => ({ items: [] }),
      listDaemonSetForAllNamespaces: async () => ({ items: [] }),
    },
  };

  const mockLocalStorage = { store: async () => {} };
  const mockConfig = { apiKey: undefined };

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();

  // Verify deployment data was processed
  expect(data.replicaCounts.deployments).toEqual([3, 5]);
  expect(data.labelsAnnotations.labelCounts.deployments).toEqual([1, 1]);
  expect(data.labelsAnnotations.annotationCounts.deployments).toEqual([1, 0]);
});

it('ResourceConfigurationPatternsCollector - collect() processes services', async () => {
  const mockServices = [
    {
      metadata: { labels: { app: 'test' } },
      spec: { type: 'ClusterIP', ports: [{ port: 80 }] },
    },
    {
      metadata: {},
      spec: { type: 'LoadBalancer', ports: [{ port: 80 }, { port: 443 }] },
    },
  ];

  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ items: [] }),
      listServiceForAllNamespaces: async () => ({ items: mockServices }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ items: [] }),
      listStatefulSetForAllNamespaces: async () => ({ items: [] }),
      listDaemonSetForAllNamespaces: async () => ({ items: [] }),
    },
  };

  const mockLocalStorage = { store: async () => {} };
  const mockConfig = { apiKey: undefined };

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();

  // Verify service data was processed
  expect(data.services.totalServices).toBe(2);
    expect(data.services.serviceTypes.ClusterIP).toBe(1);
    expect(data.services.serviceTypes.LoadBalancer).toBe(1);
    expect(data.services.portsPerService).toEqual([1, 2]);
});

it('ResourceConfigurationPatternsCollector - processCollection() stores data locally for free tier', async () => {
  let storedPayload: any = null;

  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ body: { items: [] } }),
      listServiceForAllNamespaces: async () => ({ body: { items: [] } }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ body: { items: [] } }),
      listStatefulSetForAllNamespaces: async () => ({ body: { items: [] } }),
      listDaemonSetForAllNamespaces: async () => ({ body: { items: [] } }),
    },
  };

  const mockLocalStorage = {
    store: async (payload: any) => {
      storedPayload = payload;
    },
  };

  const mockConfig = { apiKey: undefined }; // Free tier

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();
  await collector.processCollection(data);

  // Verify data was stored
  expect(storedPayload, 'Payload should be stored');
  expect(storedPayload.version).toBe('v1.0.0');
  expect(storedPayload.type).toBe('resource-configuration-patterns');
    expect(storedPayload.sanitization.rulesApplied).toEqual(['no-resource-names', 'aggregated-configuration-data']);
});

it('ResourceConfigurationPatternsCollector - processCollection() transmits data for pro tier', async () => {
  let transmittedPayload: any = null;

  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ body: { items: [] } }),
      listServiceForAllNamespaces: async () => ({ body: { items: [] } }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ body: { items: [] } }),
      listStatefulSetForAllNamespaces: async () => ({ body: { items: [] } }),
      listDaemonSetForAllNamespaces: async () => ({ body: { items: [] } }),
    },
  };

  const mockLocalStorage = {
    store: async () => {
      throw new Error('Should not store locally for pro tier');
    },
  };

  const mockTransmissionClient = {
    transmit: async (payload: any) => {
      transmittedPayload = payload;
    },
  };

  const mockConfig = { apiKey: 'test-api-key' }; // Pro tier

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    mockTransmissionClient as any,
    mockConfig as any
  );

  const data = await collector.collect();
  await collector.processCollection(data);

  // Verify data was transmitted
  expect(transmittedPayload, 'Payload should be transmitted');
  expect(transmittedPayload.type).toBe('resource-configuration-patterns');
});

it('ResourceConfigurationPatternsCollector - processCollection() handles errors gracefully', async () => {
  const mockKubernetesClient = {
    coreApi: {
      listPodForAllNamespaces: async () => ({ body: { items: [] } }),
      listServiceForAllNamespaces: async () => ({ body: { items: [] } }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: async () => ({ body: { items: [] } }),
      listStatefulSetForAllNamespaces: async () => ({ body: { items: [] } }),
      listDaemonSetForAllNamespaces: async () => ({ body: { items: [] } }),
    },
  };

  const mockLocalStorage = {
    store: async () => {
      throw new Error('Storage error');
    },
  };

  const mockConfig = { apiKey: undefined };

  const collector = new ResourceConfigurationPatternsCollector(
    mockKubernetesClient as any,
    mockLocalStorage as any,
    null,
    mockConfig as any
  );

  const data = await collector.collect();

  // Should not throw - graceful degradation
  await expect(collector.processCollection(data)).resolves.not.toThrow();
});

