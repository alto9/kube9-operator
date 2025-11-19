---
spec_id: resource-configuration-patterns-collection-spec
feature_id: [resource-configuration-patterns-collection]
diagram_id: [data-collection-flow]
context_id: [kubernetes-operator-development]
---

# Resource Configuration Patterns Collection Specification

## Overview

This specification defines the technical contract for collecting resource configuration data on a 12-hour interval. The collection extracts configuration details from workloads, services, and other cluster resources to enable pattern analysis in future phases.

## Collection Interval

| Property | Value |
|----------|-------|
| Default Interval | 43200 seconds (12 hours) |
| Minimum Interval | 3600 seconds (1 hour) - enforced for Helm overrides |
| Random Offset Range | 0-3600 seconds (0-1 hour) |
| Configurable Via | `values.metrics.intervals.resourceConfigurationPatterns` (testing/debugging only) |
| Collection Type | `resource-configuration-patterns` |

**Note:** Helm interval overrides are intended for testing and debugging only. The operator enforces minimum intervals to prevent excessive collection frequency that could impact cluster performance. Overrides are logged and reported to kube9-server for monitoring.

## Data Schema

The collected data must conform to the following schema:

```typescript
interface ResourceConfigurationPatternsData {
  // ISO 8601 timestamp of collection
  timestamp: string;
  
  // Unique identifier for this collection
  collectionId: string; // Format: "coll_[a-z0-9]{32}"
  
  // Cluster identifier
  clusterId: string; // Format: "cls_[a-z0-9]{32}"
  
  // Resource limits and requests
  resourceLimitsRequests: ResourceLimitsRequestsData;
  
  // Replica configurations
  replicaCounts: ReplicaCountsData;
  
  // Image pull policies
  imagePullPolicies: ImagePullPoliciesData;
  
  // Security contexts
  securityContexts: SecurityContextsData;
  
  // Labels and annotations
  labelsAnnotations: LabelsAnnotationsData;
  
  // Volume configurations
  volumes: VolumesData;
  
  // Service configurations
  services: ServicesData;
  
  // Probe configurations
  probes: ProbesData;
}

interface ResourceLimitsRequestsData {
  // Container resource configurations
  containers: {
    cpuRequests: string[]; // e.g., ["100m", "200m", "500m", null]
    cpuLimits: string[]; // e.g., ["1000m", "2000m", null]
    memoryRequests: string[]; // e.g., ["128Mi", "256Mi", null]
    memoryLimits: string[]; // e.g., ["512Mi", "1Gi", null]
    totalCount: number; // Total containers examined
  };
}

interface ReplicaCountsData {
  deployments: number[]; // List of replica counts from deployments
  statefulSets: number[]; // List of replica counts from statefulSets
  daemonSetCount: number; // Count of daemonSets (no replicas)
}

interface ImagePullPoliciesData {
  policies: {
    Always: number;
    IfNotPresent: number;
    Never: number;
    notSet: number;
  };
  totalContainers: number;
}

interface SecurityContextsData {
  podLevel: {
    runAsNonRoot: { true: number; false: number; notSet: number };
    fsGroup: { set: number; notSet: number };
  };
  containerLevel: {
    runAsNonRoot: { true: number; false: number; notSet: number };
    readOnlyRootFilesystem: { true: number; false: number; notSet: number };
    allowPrivilegeEscalation: { true: number; false: number; notSet: number };
    capabilities: {
      added: string[]; // List of capabilities added (e.g., ["NET_ADMIN", "SYS_TIME"])
      dropped: string[]; // List of capabilities dropped (e.g., ["ALL"])
    };
  };
  totalPods: number;
  totalContainers: number;
}

interface LabelsAnnotationsData {
  // Count of labels per resource type
  labelCounts: {
    pods: number[]; // List of label counts per pod
    deployments: number[];
    services: number[];
  };
  // Count of annotations per resource type
  annotationCounts: {
    pods: number[];
    deployments: number[];
    services: number[];
  };
  // Common label keys found (without values)
  commonLabelKeys: string[]; // e.g., ["app", "version", "component"]
}

interface VolumesData {
  // Volume types used across cluster
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
  // Volume counts per pod
  volumesPerPod: number[]; // List of volume counts
  // Volume mount counts per container
  volumeMountsPerContainer: number[]; // List of mount counts
  totalPods: number;
}

interface ServicesData {
  // Service type distribution
  serviceTypes: {
    ClusterIP: number;
    NodePort: number;
    LoadBalancer: number;
    ExternalName: number;
  };
  // Port counts per service
  portsPerService: number[]; // List of port counts
  totalServices: number;
}

interface ProbesData {
  livenessProbes: ProbeConfigData;
  readinessProbes: ProbeConfigData;
  startupProbes: ProbeConfigData;
  totalContainers: number;
}

interface ProbeConfigData {
  configured: number; // Count with probe configured
  notConfigured: number; // Count without probe configured
  probeTypes: {
    http: number;
    tcp: number;
    exec: number;
    grpc: number;
  };
  // Timing configurations
  initialDelaySeconds: number[]; // List of values
  timeoutSeconds: number[]; // List of values
  periodSeconds: number[]; // List of values
}
```

## Kubernetes API Usage

### Reading Pods with Containers

```typescript
// Use CoreV1Api to list all pods
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const podList = await coreApi.listPodForAllNamespaces();

for (const pod of podList.items) {
  // Extract resource limits/requests from each container
  for (const container of pod.spec.containers || []) {
    const cpuRequest = container.resources?.requests?.cpu;
    const cpuLimit = container.resources?.limits?.cpu;
    const memoryRequest = container.resources?.requests?.memory;
    const memoryLimit = container.resources?.limits?.memory;
    
    // Extract image pull policy
    const imagePullPolicy = container.imagePullPolicy; // "Always" | "IfNotPresent" | "Never"
    
    // Extract container security context
    const securityContext = container.securityContext;
    // securityContext.runAsNonRoot
    // securityContext.readOnlyRootFilesystem
    // securityContext.allowPrivilegeEscalation
    // securityContext.capabilities?.add
    // securityContext.capabilities?.drop
    
    // Extract probes
    const livenessProbe = container.livenessProbe;
    const readinessProbe = container.readinessProbe;
    const startupProbe = container.startupProbe;
  }
  
  // Extract pod security context
  const podSecurityContext = pod.spec.securityContext;
  // podSecurityContext.runAsNonRoot
  // podSecurityContext.fsGroup
  
  // Extract volumes
  const volumes = pod.spec.volumes || [];
  for (const volume of volumes) {
    // Determine volume type
    if (volume.configMap) { /* configMap */ }
    if (volume.secret) { /* secret */ }
    if (volume.emptyDir) { /* emptyDir */ }
    if (volume.persistentVolumeClaim) { /* persistentVolumeClaim */ }
    // etc.
  }
  
  // Extract labels and annotations
  const labelCount = Object.keys(pod.metadata.labels || {}).length;
  const annotationCount = Object.keys(pod.metadata.annotations || {}).length;
}
```

### Reading Deployments

```typescript
// Use AppsV1Api to list deployments
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const deploymentList = await appsApi.listDeploymentForAllNamespaces();

for (const deployment of deploymentList.items) {
  // Extract replica count
  const replicas = deployment.spec.replicas; // number or undefined
  
  // Extract labels and annotations
  const labelCount = Object.keys(deployment.metadata.labels || {}).length;
  const annotationCount = Object.keys(deployment.metadata.annotations || {}).length;
}
```

### Reading StatefulSets

```typescript
// Use AppsV1Api to list statefulSets
const statefulSetList = await appsApi.listStatefulSetForAllNamespaces();

for (const statefulSet of statefulSetList.items) {
  // Extract replica count
  const replicas = statefulSet.spec.replicas; // number or undefined
}
```

### Reading DaemonSets

```typescript
// Use AppsV1Api to list daemonSets
const daemonSetList = await appsApi.listDaemonSetForAllNamespaces();

// DaemonSets don't have replica counts, just count them
const daemonSetCount = daemonSetList.items.length;
```

### Reading Services

```typescript
// Use CoreV1Api to list services
const serviceList = await coreApi.listServiceForAllNamespaces();

for (const service of serviceList.items) {
  // Extract service type
  const serviceType = service.spec.type; // "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName"
  
  // Count ports
  const portCount = service.spec.ports?.length || 0;
  
  // Extract labels and annotations
  const labelCount = Object.keys(service.metadata.labels || {}).length;
  const annotationCount = Object.keys(service.metadata.annotations || {}).length;
}
```

## Collection Process

### Step 1: Initialize Collection

```typescript
async function collectResourceConfigurationPatterns(): Promise<ResourceConfigurationPatternsData> {
  const timestamp = new Date().toISOString();
  const collectionId = generateCollectionId(); // "coll_[32-char-hash]"
  const clusterId = getClusterId(); // "cls_[32-char-hash]"
  
  const data: ResourceConfigurationPatternsData = {
    timestamp,
    collectionId,
    clusterId,
    resourceLimitsRequests: initResourceLimitsRequestsData(),
    replicaCounts: initReplicaCountsData(),
    imagePullPolicies: initImagePullPoliciesData(),
    securityContexts: initSecurityContextsData(),
    labelsAnnotations: initLabelsAnnotationsData(),
    volumes: initVolumesData(),
    services: initServicesData(),
    probes: initProbesData(),
  };
  
  return data;
}
```

### Step 2: Collect from Pods

```typescript
async function collectFromPods(data: ResourceConfigurationPatternsData): Promise<void> {
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  const podList = await coreApi.listPodForAllNamespaces();
  
  for (const pod of podList.items) {
    // Process pod security context
    processpodSecurityContext(data, pod.spec.securityContext);
    
    // Process pod labels and annotations
    processPodLabelsAnnotations(data, pod.metadata);
    
    // Process volumes
    processVolumes(data, pod.spec.volumes || []);
    
    // Process each container
    for (const container of pod.spec.containers || []) {
      processContainerResources(data, container.resources);
      processImagePullPolicy(data, container.imagePullPolicy);
      processContainerSecurityContext(data, container.securityContext);
      processProbes(data, container);
    }
  }
}
```

### Step 3: Collect from Deployments, StatefulSets, DaemonSets

```typescript
async function collectFromWorkloads(data: ResourceConfigurationPatternsData): Promise<void> {
  const appsApi = kc.makeApiClient(k8s.AppsV1Api);
  
  // Deployments
  const deploymentList = await appsApi.listDeploymentForAllNamespaces();
  for (const deployment of deploymentList.items) {
    if (deployment.spec.replicas !== undefined) {
      data.replicaCounts.deployments.push(deployment.spec.replicas);
    }
    processLabelsAnnotations(data, 'deployments', deployment.metadata);
  }
  
  // StatefulSets
  const statefulSetList = await appsApi.listStatefulSetForAllNamespaces();
  for (const statefulSet of statefulSetList.items) {
    if (statefulSet.spec.replicas !== undefined) {
      data.replicaCounts.statefulSets.push(statefulSet.spec.replicas);
    }
  }
  
  // DaemonSets
  const daemonSetList = await appsApi.listDaemonSetForAllNamespaces();
  data.replicaCounts.daemonSetCount = daemonSetList.items.length;
}
```

### Step 4: Collect from Services

```typescript
async function collectFromServices(data: ResourceConfigurationPatternsData): Promise<void> {
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  const serviceList = await coreApi.listServiceForAllNamespaces();
  
  for (const service of serviceList.items) {
    const serviceType = service.spec.type || 'ClusterIP';
    data.services.serviceTypes[serviceType]++;
    
    const portCount = service.spec.ports?.length || 0;
    data.services.portsPerService.push(portCount);
    
    processLabelsAnnotations(data, 'services', service.metadata);
  }
  
  data.services.totalServices = serviceList.items.length;
}
```

### Step 5: Store Collection Data

```typescript
async function storeCollectionData(data: ResourceConfigurationPatternsData): Promise<void> {
  // Store data locally for verification
  // Storage location: /data/collections/resource-configuration-patterns/
  const filePath = `/data/collections/resource-configuration-patterns/${data.collectionId}.json`;
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  
  logger.info('Resource configuration patterns collected', {
    collectionId: data.collectionId,
    timestamp: data.timestamp,
    totalPods: data.securityContexts.totalPods,
    totalContainers: data.securityContexts.totalContainers,
    totalServices: data.services.totalServices,
  });
}
```

## Error Handling

### API Errors

- Catch and log Kubernetes API errors
- Continue collection with partial data when possible
- Track failed collection attempts in metrics
- Retry on next collection interval

### Resource Limits

- Monitor memory usage during collection
- Process resources in batches if needed
- Set timeout for collection process
- Abort collection if resource limits are approached

### Data Validation

- Validate data structure before storage
- Ensure all required fields are present
- Log validation errors
- Store partial data with validation warnings

## Performance Considerations

### Efficient API Queries

- Use `listXxxForAllNamespaces()` for cluster-wide queries
- Minimize number of API calls
- Process resources in single pass where possible

### Memory Management

- Don't store full resource objects
- Extract only needed fields
- Use streaming for large clusters
- Clear processed data from memory

### CPU Usage

- Process resources efficiently
- Avoid unnecessary computations
- Use batch processing for large datasets

## Storage

### Local Storage Structure

```
/data/collections/resource-configuration-patterns/
├── coll_abc123...json    # Collection data file
├── coll_def456...json
└── latest.json           # Symlink to latest collection
```

### Storage Limits

- Retain last 10 collections
- Remove oldest collections when limit reached
- Total storage should not exceed 100MB
- Monitor and log storage usage

## Monitoring and Logging

### Collection Metrics

- Collection success/failure count
- Collection duration (milliseconds)
- Resources processed count
- Error count per collection
- Storage size per collection

### Log Entries

```typescript
// Collection start
logger.info('Starting resource configuration patterns collection', {
  collectionId,
  timestamp,
});

// Collection success
logger.info('Resource configuration patterns collected', {
  collectionId,
  timestamp,
  duration: elapsedMs,
  totalPods,
  totalContainers,
  totalServices,
});

// Collection error
logger.error('Error collecting resource configuration patterns', {
  collectionId,
  timestamp,
  error: error.message,
  resourceType: 'pods',
});
```

## RBAC Requirements

Uses existing cluster-scoped read permissions:

- `get`, `list` on `pods`
- `get`, `list` on `deployments`
- `get`, `list` on `statefulsets`
- `get`, `list` on `daemonsets`
- `get`, `list` on `replicasets`
- `get`, `list` on `services`

No additional RBAC permissions required.

## Testing Considerations

### Unit Tests

- Test data extraction functions
- Test data structure initialization
- Test error handling
- Mock Kubernetes API responses

### Integration Tests

- Test collection in test cluster
- Verify data structure
- Verify storage
- Test with various cluster sizes

### Verification

- Inspect collected data files
- Verify no sensitive data included
- Verify data structure matches schema
- Verify storage limits are respected


