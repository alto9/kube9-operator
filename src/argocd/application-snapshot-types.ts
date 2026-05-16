/**
 * Normalized Argo CD Application snapshot produced by the Application status
 * collector (#55). Drift logic consumes only this shape — keep HTTP/API parsing
 * in the collector or {@link normalizeApplicationSnapshot}.
 */

export type ApplicationSyncPhase = 'Synced' | 'OutOfSync' | 'Unknown';

export type ApplicationHealthPhase =
  | 'Healthy'
  | 'Degraded'
  | 'Missing'
  | 'Progressing'
  | 'Suspended'
  | 'Unknown';

export interface ApplicationSnapshot {
  namespace: string;
  name: string;
  observedRevision: string | null;
  syncStatus: ApplicationSyncPhase;
  healthStatus: ApplicationHealthPhase;
  /** Resource-level comparison: count of resources reported out of sync (collector extension). */
  resourcesOutOfSyncCount?: number;
}
