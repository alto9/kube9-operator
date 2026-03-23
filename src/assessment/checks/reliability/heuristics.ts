/**
 * High availability heuristics for reliability checks.
 *
 * Determines which workloads are considered "HA-relevant" for replica,
 * spread/anti-affinity, and PDB checks.
 *
 * How to extend:
 * - Allowlist: label kube9.io/ha-required="true" marks workload as HA-relevant
 * - Denylist: label kube9.io/ha-exempt="true" skips HA checks for that workload
 * - Namespace: system namespaces (kube-system, etc.) are excluded by default
 *
 * Resource checks (requests/limits) use separate heuristics:
 * - Label kube9.io/resource-exempt="true" skips resource validation
 */

/** Label to mark a workload as requiring HA checks */
export const HA_REQUIRED_LABEL = 'kube9.io/ha-required';

/** Label to exempt a workload from HA checks */
export const HA_EXEMPT_LABEL = 'kube9.io/ha-exempt';

/** Label to exempt a workload from resource requests/limits checks */
export const RESOURCE_EXEMPT_LABEL = 'kube9.io/resource-exempt';

/** Label to exempt a workload from liveness/readiness probe checks */
export const PROBE_EXEMPT_LABEL = 'kube9.io/probe-exempt';

/** Namespaces excluded from HA and resource checks (system / infra) */
const EXCLUDED_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'tigera-operator',
  'calico-system',
]);

/** Default minimum replicas for HA workloads */
export const MIN_HA_REPLICAS = 2;

export interface WorkloadMetadata {
  namespace: string;
  name: string;
  kind: string;
  labels?: Record<string, string>;
}

/**
 * Check if a workload is exempt from HA checks (denylist).
 */
export function isHaExempt(metadata: WorkloadMetadata): boolean {
  const labels = metadata.labels ?? {};
  return labels[HA_EXEMPT_LABEL] === 'true' || labels[HA_EXEMPT_LABEL] === '1';
}

/** Check if a workload is exempt from resource checks */
export function isResourceExempt(metadata: WorkloadMetadata): boolean {
  const labels = metadata.labels ?? {};
  return labels[RESOURCE_EXEMPT_LABEL] === 'true' || labels[RESOURCE_EXEMPT_LABEL] === '1';
}

/**
 * Check if a workload's namespace is excluded from HA checks.
 */
export function isNamespaceExcluded(namespace: string): boolean {
  return EXCLUDED_NAMESPACES.has(namespace);
}

/**
 * Check if a workload should be considered HA-relevant (allowlist + heuristics).
 * Returns true if:
 * - Label kube9.io/ha-required=true, OR
 * - Not exempt, not in excluded namespace, and kind is Deployment/StatefulSet
 */
export function isHaRelevant(metadata: WorkloadMetadata): boolean {
  if (isHaExempt(metadata)) {
    return false;
  }
  if (isNamespaceExcluded(metadata.namespace)) {
    return false;
  }
  const labels = metadata.labels ?? {};
  if (labels[HA_REQUIRED_LABEL] === 'true' || labels[HA_REQUIRED_LABEL] === '1') {
    return true;
  }
  return metadata.kind === 'Deployment' || metadata.kind === 'StatefulSet';
}

/** Check if a workload should be validated for resource requests/limits */
export function isResourceCheckRelevant(metadata: WorkloadMetadata): boolean {
  if (isResourceExempt(metadata)) return false;
  if (isNamespaceExcluded(metadata.namespace)) return false;
  return true;
}

/** Check if a workload is exempt from probe checks */
export function isProbeExempt(metadata: WorkloadMetadata): boolean {
  const labels = metadata.labels ?? {};
  return labels[PROBE_EXEMPT_LABEL] === 'true' || labels[PROBE_EXEMPT_LABEL] === '1';
}

/** Check if a workload should be validated for liveness/readiness probes. Excludes Jobs/CronJobs (not in scope). */
export function isProbeCheckRelevant(metadata: WorkloadMetadata): boolean {
  if (isProbeExempt(metadata)) return false;
  if (isNamespaceExcluded(metadata.namespace)) return false;
  return true;
}
