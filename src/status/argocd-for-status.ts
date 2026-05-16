import type { ArgoCDStatus } from './types.js';
import { ArgoCDAppsRepository } from '../database/argocd-apps-repository.js';

/**
 * Adds optional {@link ArgoCDStatus.applications} when `argocd_apps` has rows.
 */
export function withPersistedArgoApplicationsSummary(detection: ArgoCDStatus): ArgoCDStatus {
  try {
    const repo = new ArgoCDAppsRepository();
    const summary = repo.getApplicationsStatusSummary();
    if (summary.storedCount === 0) {
      return detection;
    }
    return { ...detection, applications: summary };
  } catch {
    return detection;
  }
}
