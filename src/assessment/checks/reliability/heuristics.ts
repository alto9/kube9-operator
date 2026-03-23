/**
 * Resource-check heuristics for reliability assessments.
 *
 * Determines which workloads are subject to resource requests/limits validation.
 * Default: all containers in user namespaces; system namespaces excluded.
 *
 * Extend via label kube9.io/resource-exempt="true" to skip checks.
 */

/** Label to exempt a workload from resource requests/limits checks */
export const RESOURCE_EXEMPT_LABEL = 'kube9.io/resource-exempt';

/** Namespaces excluded from resource checks (system / infra) */
const EXCLUDED_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'tigera-operator',
  'calico-system',
]);

export interface WorkloadMetadata {
  namespace: string;
  name: string;
  kind: string;
  labels?: Record<string, string>;
}

/** Check if a workload is exempt from resource checks */
export function isResourceExempt(metadata: WorkloadMetadata): boolean {
  const labels = metadata.labels ?? {};
  return labels[RESOURCE_EXEMPT_LABEL] === 'true' || labels[RESOURCE_EXEMPT_LABEL] === '1';
}

/** Check if a namespace is excluded from resource checks */
export function isNamespaceExcluded(namespace: string): boolean {
  return EXCLUDED_NAMESPACES.has(namespace);
}

/** Check if a workload should be validated for resource requests/limits */
export function isResourceCheckRelevant(metadata: WorkloadMetadata): boolean {
  if (isResourceExempt(metadata)) return false;
  if (isNamespaceExcluded(metadata.namespace)) return false;
  return true;
}
