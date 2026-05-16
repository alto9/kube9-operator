import type { ArgoCdApplicationStatusBatch } from './application-status-types.js';

let lastBatch: ArgoCdApplicationStatusBatch | null = null;

/**
 * Last successful application-status snapshot for handoff to persistence (#57).
 */
export function getLastArgoCdApplicationStatusBatch(): ArgoCdApplicationStatusBatch | null {
  return lastBatch;
}

export function setLastArgoCdApplicationStatusBatch(batch: ArgoCdApplicationStatusBatch): void {
  lastBatch = batch;
}

export function clearLastArgoCdApplicationStatusBatch(): void {
  lastBatch = null;
}
