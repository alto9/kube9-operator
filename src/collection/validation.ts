/**
 * Schema validation utilities for collection data
 */

import type { ClusterMetadata, ResourceInventory } from './types.js';

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  /**
   * Field path where validation failed (e.g., "nodeCount", "namespaces.count")
   */
  readonly fieldPath: string;

  /**
   * Reason for validation failure
   */
  readonly reason: string;

  constructor(fieldPath: string, reason: string) {
    const message = `Validation failed at "${fieldPath}": ${reason}`;
    super(message);
    this.name = 'ValidationError';
    this.fieldPath = fieldPath;
    this.reason = reason;
  }
}

/**
 * Validates that a value is a string
 */
function assertString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(fieldPath, `expected string, got ${typeof value}`);
  }
  return value;
}

/**
 * Validates that a value is a number
 */
function assertNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(fieldPath, `expected number, got ${typeof value}`);
  }
  return value;
}

/**
 * Validates that a value is an integer
 */
function assertInteger(value: unknown, fieldPath: string): number {
  const num = assertNumber(value, fieldPath);
  if (!Number.isInteger(num)) {
    throw new ValidationError(fieldPath, `expected integer, got ${num}`);
  }
  return num;
}

/**
 * Validates that a value is an object
 */
function assertObject(value: unknown, fieldPath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(fieldPath, `expected object, got ${typeof value}`);
  }
  return value as Record<string, unknown>;
}

/**
 * Validates that a value is an array
 */
function assertArray(value: unknown, fieldPath: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(fieldPath, `expected array, got ${typeof value}`);
  }
  return value;
}

/**
 * Validates a string matches a regex pattern
 */
function assertPattern(value: string, pattern: RegExp, fieldPath: string, description: string): void {
  if (!pattern.test(value)) {
    throw new ValidationError(fieldPath, `expected ${description}, got "${value}"`);
  }
}

/**
 * Validates ISO 8601 timestamp format
 */
function assertISO8601Timestamp(value: string, fieldPath: string): void {
  // ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.sssZ
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (!iso8601Pattern.test(value)) {
    // Try parsing to validate it's a valid date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new ValidationError(fieldPath, `expected valid ISO 8601 timestamp, got "${value}"`);
    }
  }
}

/**
 * Validates cluster metadata against schema
 */
export function validateClusterMetadata(data: unknown): ClusterMetadata {
  const obj = assertObject(data, 'root');

  // Required fields
  const timestamp = assertString(obj.timestamp, 'timestamp');
  assertISO8601Timestamp(timestamp, 'timestamp');

  const collectionId = assertString(obj.collectionId, 'collectionId');
  assertPattern(collectionId, /^coll_[a-z0-9]{32}$/, 'collectionId', 'collection ID format "coll_[32-char-hash]"');

  const clusterId = assertString(obj.clusterId, 'clusterId');
  assertPattern(clusterId, /^cls_[a-z0-9]{32}$/, 'clusterId', 'cluster ID format "cls_[32-char-hash]"');

  const kubernetesVersion = assertString(obj.kubernetesVersion, 'kubernetesVersion');
  assertPattern(kubernetesVersion, /^v?\d+\.\d+\.\d+$/, 'kubernetesVersion', 'Kubernetes version format (e.g., "1.28.0" or "v1.28.0")');

  const nodeCount = assertInteger(obj.nodeCount, 'nodeCount');
  if (nodeCount < 1 || nodeCount > 10000) {
    throw new ValidationError('nodeCount', `expected integer between 1 and 10000, got ${nodeCount}`);
  }

  // Optional fields
  let provider: ClusterMetadata['provider'] = undefined;
  if (obj.provider !== undefined) {
    const providerValue = assertString(obj.provider, 'provider');
    const validProviders: Array<ClusterMetadata['provider']> = ['aws', 'gcp', 'azure', 'on-premise', 'other', 'unknown'];
    if (!validProviders.includes(providerValue as ClusterMetadata['provider'])) {
      throw new ValidationError('provider', `expected one of: ${validProviders.join(', ')}, got "${providerValue}"`);
    }
    provider = providerValue as ClusterMetadata['provider'];
  }

  let region: string | undefined = undefined;
  if (obj.region !== undefined) {
    region = assertString(obj.region, 'region');
    if (region.length > 50) {
      throw new ValidationError('region', `expected max 50 characters, got ${region.length}`);
    }
  }

  let zone: string | undefined = undefined;
  if (obj.zone !== undefined) {
    zone = assertString(obj.zone, 'zone');
    if (zone.length > 50) {
      throw new ValidationError('zone', `expected max 50 characters, got ${zone.length}`);
    }
  }

  return {
    timestamp,
    collectionId,
    clusterId,
    kubernetesVersion,
    nodeCount,
    provider,
    region,
    zone,
  };
}

/**
 * Validates resource inventory against schema
 */
export function validateResourceInventory(data: unknown): ResourceInventory {
  const obj = assertObject(data, 'root');

  // Required fields
  const timestamp = assertString(obj.timestamp, 'timestamp');
  assertISO8601Timestamp(timestamp, 'timestamp');

  const collectionId = assertString(obj.collectionId, 'collectionId');
  assertPattern(collectionId, /^coll_[a-z0-9]{32}$/, 'collectionId', 'collection ID format "coll_[32-char-hash]"');

  const clusterId = assertString(obj.clusterId, 'clusterId');
  assertPattern(clusterId, /^cls_[a-z0-9]{32}$/, 'clusterId', 'cluster ID format "cls_[32-char-hash]"');

  // Validate namespaces
  const namespacesObj = assertObject(obj.namespaces, 'namespaces');
  const namespaceCount = assertInteger(namespacesObj.count, 'namespaces.count');
  if (namespaceCount < 0) {
    throw new ValidationError('namespaces.count', `expected integer >= 0, got ${namespaceCount}`);
  }

  const namespaceList = assertArray(namespacesObj.list, 'namespaces.list');
  if (namespaceList.length !== namespaceCount) {
    throw new ValidationError('namespaces.list', `expected length ${namespaceCount} to match namespaces.count, got ${namespaceList.length}`);
  }

  const validatedNamespaceList: string[] = [];
  for (let i = 0; i < namespaceList.length; i++) {
    const nsId = assertString(namespaceList[i], `namespaces.list[${i}]`);
    assertPattern(nsId, /^namespace-[a-f0-9]{12}$/, `namespaces.list[${i}]`, 'namespace identifier format "namespace-[12-char-hash]"');
    validatedNamespaceList.push(nsId);
  }

  // Validate resources
  const resourcesObj = assertObject(obj.resources, 'resources');

  // Validate pods
  const podsObj = assertObject(resourcesObj.pods, 'resources.pods');
  const podsTotal = assertInteger(podsObj.total, 'resources.pods.total');
  if (podsTotal < 0) {
    throw new ValidationError('resources.pods.total', `expected integer >= 0, got ${podsTotal}`);
  }

  const podsByNamespaceObj = assertObject(podsObj.byNamespace, 'resources.pods.byNamespace');
  const podsByNamespace: Record<string, number> = {};
  for (const [key, value] of Object.entries(podsByNamespaceObj)) {
    // Validate namespace identifier format in keys
    assertPattern(key, /^namespace-[a-f0-9]{12}$/, `resources.pods.byNamespace["${key}"]`, 'namespace identifier format "namespace-[12-char-hash]"');
    const count = assertInteger(value, `resources.pods.byNamespace["${key}"]`);
    if (count < 0) {
      throw new ValidationError(`resources.pods.byNamespace["${key}"]`, `expected integer >= 0, got ${count}`);
    }
    podsByNamespace[key] = count;
  }

  // Validate deployments
  const deploymentsObj = assertObject(resourcesObj.deployments, 'resources.deployments');
  const deploymentsTotal = assertInteger(deploymentsObj.total, 'resources.deployments.total');
  if (deploymentsTotal < 0) {
    throw new ValidationError('resources.deployments.total', `expected integer >= 0, got ${deploymentsTotal}`);
  }

  // Validate statefulSets
  const statefulSetsObj = assertObject(resourcesObj.statefulSets, 'resources.statefulSets');
  const statefulSetsTotal = assertInteger(statefulSetsObj.total, 'resources.statefulSets.total');
  if (statefulSetsTotal < 0) {
    throw new ValidationError('resources.statefulSets.total', `expected integer >= 0, got ${statefulSetsTotal}`);
  }

  // Validate replicaSets
  const replicaSetsObj = assertObject(resourcesObj.replicaSets, 'resources.replicaSets');
  const replicaSetsTotal = assertInteger(replicaSetsObj.total, 'resources.replicaSets.total');
  if (replicaSetsTotal < 0) {
    throw new ValidationError('resources.replicaSets.total', `expected integer >= 0, got ${replicaSetsTotal}`);
  }

  // Validate services
  const servicesObj = assertObject(resourcesObj.services, 'resources.services');
  const servicesTotal = assertInteger(servicesObj.total, 'resources.services.total');
  if (servicesTotal < 0) {
    throw new ValidationError('resources.services.total', `expected integer >= 0, got ${servicesTotal}`);
  }

  const servicesByTypeObj = assertObject(servicesObj.byType, 'resources.services.byType');
  const validServiceTypes = ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'];
  const servicesByType: ResourceInventory['resources']['services']['byType'] = {};
  for (const [key, value] of Object.entries(servicesByTypeObj)) {
    if (!validServiceTypes.includes(key)) {
      throw new ValidationError(`resources.services.byType["${key}"]`, `expected one of: ${validServiceTypes.join(', ')}, got "${key}"`);
    }
    const count = assertInteger(value, `resources.services.byType["${key}"]`);
    if (count < 0) {
      throw new ValidationError(`resources.services.byType["${key}"]`, `expected integer >= 0, got ${count}`);
    }
    servicesByType[key as keyof typeof servicesByType] = count;
  }

  return {
    timestamp,
    collectionId,
    clusterId,
    namespaces: {
      count: namespaceCount,
      list: validatedNamespaceList,
    },
    resources: {
      pods: {
        total: podsTotal,
        byNamespace: podsByNamespace,
      },
      deployments: {
        total: deploymentsTotal,
      },
      statefulSets: {
        total: statefulSetsTotal,
      },
      replicaSets: {
        total: replicaSetsTotal,
      },
      services: {
        total: servicesTotal,
        byType: servicesByType,
      },
    },
  };
}

