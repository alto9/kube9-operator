import { test } from 'node:test';
import * as assert from 'node:assert';
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
} from './resource-configuration-patterns.js';

test('initResourceLimitsRequestsData - returns proper structure', () => {
  const data = initResourceLimitsRequestsData();
  
  // Verify structure
  assert.ok(data.containers, 'Should have containers object');
  assert.ok(Array.isArray(data.containers.cpuRequests), 'Should have cpuRequests array');
  assert.ok(Array.isArray(data.containers.cpuLimits), 'Should have cpuLimits array');
  assert.ok(Array.isArray(data.containers.memoryRequests), 'Should have memoryRequests array');
  assert.ok(Array.isArray(data.containers.memoryLimits), 'Should have memoryLimits array');
  assert.strictEqual(typeof data.containers.totalCount, 'number', 'Should have totalCount number');
});

test('initResourceLimitsRequestsData - all arrays are empty', () => {
  const data = initResourceLimitsRequestsData();
  
  assert.strictEqual(data.containers.cpuRequests.length, 0, 'cpuRequests should be empty');
  assert.strictEqual(data.containers.cpuLimits.length, 0, 'cpuLimits should be empty');
  assert.strictEqual(data.containers.memoryRequests.length, 0, 'memoryRequests should be empty');
  assert.strictEqual(data.containers.memoryLimits.length, 0, 'memoryLimits should be empty');
});

test('initResourceLimitsRequestsData - totalCount is zero', () => {
  const data = initResourceLimitsRequestsData();
  
  assert.strictEqual(data.containers.totalCount, 0, 'totalCount should be 0');
});

test('initReplicaCountsData - returns proper structure', () => {
  const data = initReplicaCountsData();
  
  assert.ok(Array.isArray(data.deployments), 'Should have deployments array');
  assert.ok(Array.isArray(data.statefulSets), 'Should have statefulSets array');
  assert.strictEqual(typeof data.daemonSetCount, 'number', 'Should have daemonSetCount number');
});

test('initReplicaCountsData - all arrays are empty and count is zero', () => {
  const data = initReplicaCountsData();
  
  assert.strictEqual(data.deployments.length, 0, 'deployments should be empty');
  assert.strictEqual(data.statefulSets.length, 0, 'statefulSets should be empty');
  assert.strictEqual(data.daemonSetCount, 0, 'daemonSetCount should be 0');
});

test('initImagePullPoliciesData - returns proper structure', () => {
  const data = initImagePullPoliciesData();
  
  assert.ok(data.policies, 'Should have policies object');
  assert.strictEqual(typeof data.policies.Always, 'number', 'Should have Always count');
  assert.strictEqual(typeof data.policies.IfNotPresent, 'number', 'Should have IfNotPresent count');
  assert.strictEqual(typeof data.policies.Never, 'number', 'Should have Never count');
  assert.strictEqual(typeof data.policies.notSet, 'number', 'Should have notSet count');
  assert.strictEqual(typeof data.totalContainers, 'number', 'Should have totalContainers count');
});

test('initImagePullPoliciesData - all counts are zero', () => {
  const data = initImagePullPoliciesData();
  
  assert.strictEqual(data.policies.Always, 0, 'Always should be 0');
  assert.strictEqual(data.policies.IfNotPresent, 0, 'IfNotPresent should be 0');
  assert.strictEqual(data.policies.Never, 0, 'Never should be 0');
  assert.strictEqual(data.policies.notSet, 0, 'notSet should be 0');
  assert.strictEqual(data.totalContainers, 0, 'totalContainers should be 0');
});

test('initSecurityContextsData - returns proper structure', () => {
  const data = initSecurityContextsData();
  
  // Pod level
  assert.ok(data.podLevel, 'Should have podLevel object');
  assert.ok(data.podLevel.runAsNonRoot, 'Should have podLevel.runAsNonRoot object');
  assert.ok(data.podLevel.fsGroup, 'Should have podLevel.fsGroup object');
  
  // Container level
  assert.ok(data.containerLevel, 'Should have containerLevel object');
  assert.ok(data.containerLevel.runAsNonRoot, 'Should have containerLevel.runAsNonRoot object');
  assert.ok(data.containerLevel.readOnlyRootFilesystem, 'Should have containerLevel.readOnlyRootFilesystem object');
  assert.ok(data.containerLevel.allowPrivilegeEscalation, 'Should have containerLevel.allowPrivilegeEscalation object');
  assert.ok(data.containerLevel.capabilities, 'Should have containerLevel.capabilities object');
  
  // Totals
  assert.strictEqual(typeof data.totalPods, 'number', 'Should have totalPods number');
  assert.strictEqual(typeof data.totalContainers, 'number', 'Should have totalContainers number');
});

test('initSecurityContextsData - all counts are zero', () => {
  const data = initSecurityContextsData();
  
  // Pod level counts
  assert.strictEqual(data.podLevel.runAsNonRoot.true, 0, 'podLevel.runAsNonRoot.true should be 0');
  assert.strictEqual(data.podLevel.runAsNonRoot.false, 0, 'podLevel.runAsNonRoot.false should be 0');
  assert.strictEqual(data.podLevel.runAsNonRoot.notSet, 0, 'podLevel.runAsNonRoot.notSet should be 0');
  assert.strictEqual(data.podLevel.fsGroup.set, 0, 'podLevel.fsGroup.set should be 0');
  assert.strictEqual(data.podLevel.fsGroup.notSet, 0, 'podLevel.fsGroup.notSet should be 0');
  
  // Container level counts
  assert.strictEqual(data.containerLevel.runAsNonRoot.true, 0, 'containerLevel.runAsNonRoot.true should be 0');
  assert.strictEqual(data.containerLevel.runAsNonRoot.false, 0, 'containerLevel.runAsNonRoot.false should be 0');
  assert.strictEqual(data.containerLevel.runAsNonRoot.notSet, 0, 'containerLevel.runAsNonRoot.notSet should be 0');
  assert.strictEqual(data.containerLevel.readOnlyRootFilesystem.true, 0, 'containerLevel.readOnlyRootFilesystem.true should be 0');
  assert.strictEqual(data.containerLevel.readOnlyRootFilesystem.false, 0, 'containerLevel.readOnlyRootFilesystem.false should be 0');
  assert.strictEqual(data.containerLevel.readOnlyRootFilesystem.notSet, 0, 'containerLevel.readOnlyRootFilesystem.notSet should be 0');
  assert.strictEqual(data.containerLevel.allowPrivilegeEscalation.true, 0, 'containerLevel.allowPrivilegeEscalation.true should be 0');
  assert.strictEqual(data.containerLevel.allowPrivilegeEscalation.false, 0, 'containerLevel.allowPrivilegeEscalation.false should be 0');
  assert.strictEqual(data.containerLevel.allowPrivilegeEscalation.notSet, 0, 'containerLevel.allowPrivilegeEscalation.notSet should be 0');
  
  // Totals
  assert.strictEqual(data.totalPods, 0, 'totalPods should be 0');
  assert.strictEqual(data.totalContainers, 0, 'totalContainers should be 0');
});

test('initSecurityContextsData - capabilities arrays are empty', () => {
  const data = initSecurityContextsData();
  
  assert.ok(Array.isArray(data.containerLevel.capabilities.added), 'capabilities.added should be array');
  assert.ok(Array.isArray(data.containerLevel.capabilities.dropped), 'capabilities.dropped should be array');
  assert.strictEqual(data.containerLevel.capabilities.added.length, 0, 'capabilities.added should be empty');
  assert.strictEqual(data.containerLevel.capabilities.dropped.length, 0, 'capabilities.dropped should be empty');
});

test('initLabelsAnnotationsData - returns proper structure', () => {
  const data = initLabelsAnnotationsData();
  
  assert.ok(data.labelCounts, 'Should have labelCounts object');
  assert.ok(Array.isArray(data.labelCounts.pods), 'Should have labelCounts.pods array');
  assert.ok(Array.isArray(data.labelCounts.deployments), 'Should have labelCounts.deployments array');
  assert.ok(Array.isArray(data.labelCounts.services), 'Should have labelCounts.services array');
  
  assert.ok(data.annotationCounts, 'Should have annotationCounts object');
  assert.ok(Array.isArray(data.annotationCounts.pods), 'Should have annotationCounts.pods array');
  assert.ok(Array.isArray(data.annotationCounts.deployments), 'Should have annotationCounts.deployments array');
  assert.ok(Array.isArray(data.annotationCounts.services), 'Should have annotationCounts.services array');
  
  assert.ok(Array.isArray(data.commonLabelKeys), 'Should have commonLabelKeys array');
});

test('initLabelsAnnotationsData - all arrays are empty', () => {
  const data = initLabelsAnnotationsData();
  
  assert.strictEqual(data.labelCounts.pods.length, 0, 'labelCounts.pods should be empty');
  assert.strictEqual(data.labelCounts.deployments.length, 0, 'labelCounts.deployments should be empty');
  assert.strictEqual(data.labelCounts.services.length, 0, 'labelCounts.services should be empty');
  
  assert.strictEqual(data.annotationCounts.pods.length, 0, 'annotationCounts.pods should be empty');
  assert.strictEqual(data.annotationCounts.deployments.length, 0, 'annotationCounts.deployments should be empty');
  assert.strictEqual(data.annotationCounts.services.length, 0, 'annotationCounts.services should be empty');
  
  assert.strictEqual(data.commonLabelKeys.length, 0, 'commonLabelKeys should be empty');
});

test('initVolumesData - returns proper structure', () => {
  const data = initVolumesData();
  
  assert.ok(data.volumeTypes, 'Should have volumeTypes object');
  assert.strictEqual(typeof data.volumeTypes.configMap, 'number', 'Should have configMap count');
  assert.strictEqual(typeof data.volumeTypes.secret, 'number', 'Should have secret count');
  assert.strictEqual(typeof data.volumeTypes.emptyDir, 'number', 'Should have emptyDir count');
  assert.strictEqual(typeof data.volumeTypes.persistentVolumeClaim, 'number', 'Should have persistentVolumeClaim count');
  assert.strictEqual(typeof data.volumeTypes.hostPath, 'number', 'Should have hostPath count');
  assert.strictEqual(typeof data.volumeTypes.downwardAPI, 'number', 'Should have downwardAPI count');
  assert.strictEqual(typeof data.volumeTypes.projected, 'number', 'Should have projected count');
  assert.strictEqual(typeof data.volumeTypes.other, 'number', 'Should have other count');
  
  assert.ok(Array.isArray(data.volumesPerPod), 'Should have volumesPerPod array');
  assert.ok(Array.isArray(data.volumeMountsPerContainer), 'Should have volumeMountsPerContainer array');
  assert.strictEqual(typeof data.totalPods, 'number', 'Should have totalPods number');
});

test('initVolumesData - all counts are zero and arrays are empty', () => {
  const data = initVolumesData();
  
  assert.strictEqual(data.volumeTypes.configMap, 0, 'configMap should be 0');
  assert.strictEqual(data.volumeTypes.secret, 0, 'secret should be 0');
  assert.strictEqual(data.volumeTypes.emptyDir, 0, 'emptyDir should be 0');
  assert.strictEqual(data.volumeTypes.persistentVolumeClaim, 0, 'persistentVolumeClaim should be 0');
  assert.strictEqual(data.volumeTypes.hostPath, 0, 'hostPath should be 0');
  assert.strictEqual(data.volumeTypes.downwardAPI, 0, 'downwardAPI should be 0');
  assert.strictEqual(data.volumeTypes.projected, 0, 'projected should be 0');
  assert.strictEqual(data.volumeTypes.other, 0, 'other should be 0');
  
  assert.strictEqual(data.volumesPerPod.length, 0, 'volumesPerPod should be empty');
  assert.strictEqual(data.volumeMountsPerContainer.length, 0, 'volumeMountsPerContainer should be empty');
  assert.strictEqual(data.totalPods, 0, 'totalPods should be 0');
});

test('initServicesData - returns proper structure', () => {
  const data = initServicesData();
  
  assert.ok(data.serviceTypes, 'Should have serviceTypes object');
  assert.strictEqual(typeof data.serviceTypes.ClusterIP, 'number', 'Should have ClusterIP count');
  assert.strictEqual(typeof data.serviceTypes.NodePort, 'number', 'Should have NodePort count');
  assert.strictEqual(typeof data.serviceTypes.LoadBalancer, 'number', 'Should have LoadBalancer count');
  assert.strictEqual(typeof data.serviceTypes.ExternalName, 'number', 'Should have ExternalName count');
  
  assert.ok(Array.isArray(data.portsPerService), 'Should have portsPerService array');
  assert.strictEqual(typeof data.totalServices, 'number', 'Should have totalServices number');
});

test('initServicesData - all counts are zero and array is empty', () => {
  const data = initServicesData();
  
  assert.strictEqual(data.serviceTypes.ClusterIP, 0, 'ClusterIP should be 0');
  assert.strictEqual(data.serviceTypes.NodePort, 0, 'NodePort should be 0');
  assert.strictEqual(data.serviceTypes.LoadBalancer, 0, 'LoadBalancer should be 0');
  assert.strictEqual(data.serviceTypes.ExternalName, 0, 'ExternalName should be 0');
  
  assert.strictEqual(data.portsPerService.length, 0, 'portsPerService should be empty');
  assert.strictEqual(data.totalServices, 0, 'totalServices should be 0');
});

test('initProbeConfigData - returns proper structure', () => {
  const data = initProbeConfigData();
  
  assert.strictEqual(typeof data.configured, 'number', 'Should have configured count');
  assert.strictEqual(typeof data.notConfigured, 'number', 'Should have notConfigured count');
  
  assert.ok(data.probeTypes, 'Should have probeTypes object');
  assert.strictEqual(typeof data.probeTypes.http, 'number', 'Should have http count');
  assert.strictEqual(typeof data.probeTypes.tcp, 'number', 'Should have tcp count');
  assert.strictEqual(typeof data.probeTypes.exec, 'number', 'Should have exec count');
  assert.strictEqual(typeof data.probeTypes.grpc, 'number', 'Should have grpc count');
  
  assert.ok(Array.isArray(data.initialDelaySeconds), 'Should have initialDelaySeconds array');
  assert.ok(Array.isArray(data.timeoutSeconds), 'Should have timeoutSeconds array');
  assert.ok(Array.isArray(data.periodSeconds), 'Should have periodSeconds array');
});

test('initProbeConfigData - all counts are zero and arrays are empty', () => {
  const data = initProbeConfigData();
  
  assert.strictEqual(data.configured, 0, 'configured should be 0');
  assert.strictEqual(data.notConfigured, 0, 'notConfigured should be 0');
  
  assert.strictEqual(data.probeTypes.http, 0, 'http should be 0');
  assert.strictEqual(data.probeTypes.tcp, 0, 'tcp should be 0');
  assert.strictEqual(data.probeTypes.exec, 0, 'exec should be 0');
  assert.strictEqual(data.probeTypes.grpc, 0, 'grpc should be 0');
  
  assert.strictEqual(data.initialDelaySeconds.length, 0, 'initialDelaySeconds should be empty');
  assert.strictEqual(data.timeoutSeconds.length, 0, 'timeoutSeconds should be empty');
  assert.strictEqual(data.periodSeconds.length, 0, 'periodSeconds should be empty');
});

test('initProbesData - returns proper structure', () => {
  const data = initProbesData();
  
  assert.ok(data.livenessProbes, 'Should have livenessProbes object');
  assert.ok(data.readinessProbes, 'Should have readinessProbes object');
  assert.ok(data.startupProbes, 'Should have startupProbes object');
  assert.strictEqual(typeof data.totalContainers, 'number', 'Should have totalContainers number');
});

test('initProbesData - all probe configs are initialized', () => {
  const data = initProbesData();
  
  // Verify liveness probes initialized
  assert.strictEqual(data.livenessProbes.configured, 0, 'livenessProbes.configured should be 0');
  assert.strictEqual(data.livenessProbes.notConfigured, 0, 'livenessProbes.notConfigured should be 0');
  assert.ok(data.livenessProbes.probeTypes, 'livenessProbes should have probeTypes');
  
  // Verify readiness probes initialized
  assert.strictEqual(data.readinessProbes.configured, 0, 'readinessProbes.configured should be 0');
  assert.strictEqual(data.readinessProbes.notConfigured, 0, 'readinessProbes.notConfigured should be 0');
  assert.ok(data.readinessProbes.probeTypes, 'readinessProbes should have probeTypes');
  
  // Verify startup probes initialized
  assert.strictEqual(data.startupProbes.configured, 0, 'startupProbes.configured should be 0');
  assert.strictEqual(data.startupProbes.notConfigured, 0, 'startupProbes.notConfigured should be 0');
  assert.ok(data.startupProbes.probeTypes, 'startupProbes should have probeTypes');
  
  // Verify total
  assert.strictEqual(data.totalContainers, 0, 'totalContainers should be 0');
});

test('initProbesData - probe configs have independent instances', () => {
  const data = initProbesData();
  
  // Modify one probe config
  data.livenessProbes.configured = 5;
  
  // Verify others are not affected
  assert.strictEqual(data.readinessProbes.configured, 0, 'readinessProbes should not be affected');
  assert.strictEqual(data.startupProbes.configured, 0, 'startupProbes should not be affected');
});

