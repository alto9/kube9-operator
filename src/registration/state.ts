import type { RegistrationState } from '../status/types.js';

/**
 * Manages registration state in a thread-safe manner
 * 
 * Provides atomic state updates and getter for status calculator integration
 */
export class RegistrationStateManager {
  private state: RegistrationState;

  constructor() {
    this.state = {
      isRegistered: false,
      clusterId: undefined,
      consecutiveFailures: 0,
    };
  }

  /**
   * Get current registration state
   * Returns a copy to prevent external mutations
   */
  getState(): RegistrationState {
    return { ...this.state };
  }

  /**
   * Update registration state with successful registration
   */
  setRegistered(clusterId: string): void {
    this.state = {
      isRegistered: true,
      clusterId,
      consecutiveFailures: 0,
    };
  }

  /**
   * Update registration state with failure
   */
  setFailed(error?: string): void {
    this.state = {
      isRegistered: false,
      clusterId: undefined,
      consecutiveFailures: (this.state.consecutiveFailures || 0) + 1,
    };
  }

  /**
   * Reset registration state (e.g., when API key is removed)
   */
  reset(): void {
    this.state = {
      isRegistered: false,
      clusterId: undefined,
      consecutiveFailures: 0,
    };
  }
}

