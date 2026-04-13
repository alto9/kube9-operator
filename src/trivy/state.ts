/**
 * In-memory Trivy detection status for operator status ConfigMap.
 */

import type { TrivyStatus } from '../status/types.js';

const DEFAULT_TRIVY_STATUS: TrivyStatus = {
  detected: false,
  serverUrl: null,
  version: null,
  lastChecked: new Date().toISOString(),
};

export class TrivyStatusTracker {
  private status: TrivyStatus = { ...DEFAULT_TRIVY_STATUS };

  getStatus(): TrivyStatus {
    return { ...this.status };
  }

  setStatus(status: TrivyStatus): void {
    this.status = { ...status };
  }

  reset(): void {
    this.status = { ...DEFAULT_TRIVY_STATUS };
  }
}

export const trivyStatusTracker = new TrivyStatusTracker();
