/**
 * Normalized Argo CD Application sync/health payloads produced by the M9 collector (#55).
 *
 * Persistence (#57) should consume {@link ArgoCdApplicationStatusBatch} via
 * {@link getLastArgoCdApplicationStatusBatch} / future repository APIs — do not redefine
 * shapes ad hoc; extend this module if new fields are required for storage.
 */

export interface ArgoCdApplicationStatusRecord {
  /** Application name (Argo CD Application resource). */
  name: string;
  /** Kubernetes namespace of the Application resource. */
  namespace: string;
  /** Argo CD sync phase, e.g. Synced, OutOfSync. */
  syncStatus: string | null;
  /** Argo CD health, e.g. Healthy, Degraded. */
  healthStatus: string | null;
  /** Observed revision / target revision string when present. */
  revision: string | null;
}

/**
 * One collection pass over the Argo CD Application API (immutable snapshot).
 */
export interface ArgoCdApplicationStatusBatch {
  version: '1.0';
  collectedAt: string;
  collectionId: string;
  clusterId: string;
  /** Argo CD control plane namespace when known (detection). */
  argocdNamespace: string | null;
  /** Base URL used for the Argo CD REST call (no trailing slash). */
  apiBaseUrl: string;
  applications: ArgoCdApplicationStatusRecord[];
}
