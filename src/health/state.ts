/**
 * Health state tracking for operator initialization
 * 
 * Tracks whether the operator has completed initialization and is ready
 * to serve requests. Used by readiness probe to determine if operator
 * is ready to accept traffic.
 */

let isInitialized = false;

/**
 * Set the initialization state of the operator
 * 
 * @param initialized - Whether the operator has completed initialization
 */
export function setInitialized(initialized: boolean): void {
  isInitialized = initialized;
}

/**
 * Get the current initialization state
 * 
 * @returns true if operator has completed initialization, false otherwise
 */
export function getInitialized(): boolean {
  return isInitialized;
}

