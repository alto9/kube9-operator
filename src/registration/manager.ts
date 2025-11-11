import type { Config } from '../config/types.js';
import { RegistrationClient } from './client.js';
import type { RegistrationRequest, RegistrationResponse } from './types.js';
import {
  UnauthorizedError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from './types.js';
import { RegistrationStateManager } from './state.js';
import type { RegistrationState } from '../status/types.js';
import type { ClusterInfo } from '../kubernetes/client.js';

/**
 * Operator version (semver)
 * TODO: Read from package.json in future
 */
const OPERATOR_VERSION = '1.0.0';

/**
 * Exponential backoff delays in milliseconds
 * Used for network errors and server errors (5xx)
 */
const BACKOFF_DELAYS_MS = [
  5 * 60 * 1000,  // 5 minutes
  10 * 60 * 1000, // 10 minutes
  20 * 60 * 1000, // 20 minutes
];

/**
 * Maximum number of retry attempts before giving up
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * RegistrationManager orchestrates the registration lifecycle:
 * - Initial registration on startup (if API key present)
 * - Periodic re-registration every N hours
 * - Error handling with exponential backoff
 * - State management for status calculator integration
 */
export class RegistrationManager {
  private readonly config: Config;
  private readonly client: RegistrationClient;
  private readonly stateManager: RegistrationStateManager;
  private readonly getClusterIdentifier: () => string;
  private readonly getClusterInfo: () => Promise<ClusterInfo>;
  
  private reregistrationTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private isStopped = false;

  /**
   * Creates a new RegistrationManager instance
   * 
   * @param config - Operator configuration
   * @param client - Registration client for HTTP communication
   * @param getClusterIdentifier - Function to generate cluster identifier
   * @param getClusterInfo - Function to get cluster information
   */
  constructor(
    config: Config,
    client: RegistrationClient,
    getClusterIdentifier: () => string,
    getClusterInfo: () => Promise<ClusterInfo>
  ) {
    this.config = config;
    this.client = client;
    this.stateManager = new RegistrationStateManager();
    this.getClusterIdentifier = getClusterIdentifier;
    this.getClusterInfo = getClusterInfo;
  }

  /**
   * Get current registration state
   * Used by status calculator to determine operator tier and health
   */
  getState(): RegistrationState {
    return this.stateManager.getState();
  }

  /**
   * Start registration process
   * 
   * If API key is present, initiates initial registration.
   * If no API key, skips registration and resets state.
   */
  async start(): Promise<void> {
    if (this.isStopped) {
      console.warn('RegistrationManager is stopped, cannot start');
      return;
    }

    // Skip registration if no API key
    if (!this.config.apiKey) {
      console.log('No API key configured - skipping registration (free tier mode)');
      this.stateManager.reset();
      return;
    }

    console.log('Starting registration manager...');
    
    // Perform initial registration
    // Note: scheduleReregistration will be called after successful registration
    await this.performRegistration();
  }

  /**
   * Stop registration manager and clean up timers
   */
  stop(): void {
    if (this.isStopped) {
      return;
    }

    console.log('Stopping registration manager...');
    this.isStopped = true;

    // Clear re-registration timer
    if (this.reregistrationTimer !== null) {
      clearInterval(this.reregistrationTimer);
      this.reregistrationTimer = null;
    }

    // Clear retry timer
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Perform registration with kube9-server
   * Handles all error types and schedules retries as appropriate
   */
  private async performRegistration(): Promise<void> {
    if (this.isStopped) {
      return;
    }

    try {
      // Get cluster information
      const clusterInfo = await this.getClusterInfo();
      const clusterIdentifier = this.getClusterIdentifier();

      // Build registration request
      const request: RegistrationRequest = {
        operatorVersion: OPERATOR_VERSION,
        clusterIdentifier,
        kubernetesVersion: clusterInfo.version,
        approximateNodeCount: clusterInfo.nodeCount,
      };

      console.log('Registering with kube9-server...');
      console.log(`  Cluster identifier: ${clusterIdentifier}`);
      console.log(`  Kubernetes version: ${clusterInfo.version}`);
      console.log(`  Node count: ${clusterInfo.nodeCount}`);

      // Call registration client
      const response: RegistrationResponse = await this.client.register(request);

      // Registration successful
      console.log(`Registration successful: ${response.status}`);
      console.log(`  Cluster ID: ${response.clusterId}`);
      console.log(`  Tier: ${response.tier}`);
      if (response.message) {
        console.log(`  Message: ${response.message}`);
      }

      // Update state
      this.stateManager.setRegistered(response.clusterId);

      // Reset retry attempt counter on success
      this.retryAttempt = 0;

      // Clear any pending retry timer
      if (this.retryTimer !== null) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      // Schedule next re-registration based on server configuration
      if (!this.isStopped) {
        const intervalHours = response.configuration.reregistrationIntervalHours;
        this.scheduleReregistration(intervalHours);
      }
    } catch (error) {
      await this.handleRegistrationError(error);
    }
  }

  /**
   * Handle registration errors and schedule retries as appropriate
   */
  private async handleRegistrationError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific error types
    if (error instanceof UnauthorizedError) {
      // Invalid API key - don't retry, fall back to operated mode
      console.error('Registration failed: Invalid API key');
      console.error('  Falling back to operated (free tier) mode');
      this.stateManager.setFailed('Invalid API key');
      this.retryAttempt = 0; // Reset retry attempts
      return;
    }

    if (error instanceof RateLimitError) {
      // Rate limited - respect Retry-After header
      const retryAfterMs = error.retryAfter
        ? error.retryAfter * 1000
        : 60 * 60 * 1000; // Default to 1 hour if no Retry-After header

      console.warn(`Registration rate limited, retrying after ${retryAfterMs / 1000}s`);
      this.stateManager.setFailed(`Rate limited: ${errorMessage}`);
      
      // Schedule retry after rate limit period
      if (!this.isStopped) {
        this.retryTimer = setTimeout(() => {
          this.retryAttempt = 0; // Reset retry attempts for rate limit retry
          this.performRegistration();
        }, retryAfterMs);
      }
      return;
    }

    if (error instanceof ServerError || error instanceof TimeoutError) {
      // Network error or server error - retry with exponential backoff
      this.retryAttempt++;
      
      if (this.retryAttempt > MAX_RETRY_ATTEMPTS) {
        console.error(`Registration failed after ${MAX_RETRY_ATTEMPTS} retry attempts`);
        console.error(`  Last error: ${errorMessage}`);
        this.stateManager.setFailed(`Registration failed: ${errorMessage}`);
        return;
      }

      const backoffDelay = BACKOFF_DELAYS_MS[this.retryAttempt - 1] || BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
      console.warn(`Registration failed (attempt ${this.retryAttempt}/${MAX_RETRY_ATTEMPTS}): ${errorMessage}`);
      console.warn(`  Retrying in ${backoffDelay / 1000 / 60} minutes...`);
      this.stateManager.setFailed(`Registration failed: ${errorMessage}`);

      // Schedule retry with exponential backoff
      if (!this.isStopped) {
        this.retryTimer = setTimeout(() => {
          this.performRegistration();
        }, backoffDelay);
      }
      return;
    }

    // Unknown error - treat as network error and retry
    console.error(`Registration failed with unknown error: ${errorMessage}`);
    this.retryAttempt++;
    
    if (this.retryAttempt > MAX_RETRY_ATTEMPTS) {
      console.error(`Registration failed after ${MAX_RETRY_ATTEMPTS} retry attempts`);
      this.stateManager.setFailed(`Registration failed: ${errorMessage}`);
      return;
    }

    const backoffDelay = BACKOFF_DELAYS_MS[this.retryAttempt - 1] || BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
    console.warn(`Retrying registration in ${backoffDelay / 1000 / 60} minutes...`);
    this.stateManager.setFailed(`Registration failed: ${errorMessage}`);

    if (!this.isStopped) {
      this.retryTimer = setTimeout(() => {
        this.performRegistration();
      }, backoffDelay);
    }
  }

  /**
   * Schedule periodic re-registration
   * 
   * @param intervalHours - Re-registration interval in hours (defaults to config value)
   */
  private scheduleReregistration(intervalHours?: number): void {
    // Clear existing timer if any
    if (this.reregistrationTimer !== null) {
      clearInterval(this.reregistrationTimer);
      this.reregistrationTimer = null;
    }

    const hours = intervalHours ?? this.config.reregistrationIntervalHours;
    const intervalMs = hours * 60 * 60 * 1000;

    console.log(`Scheduling re-registration every ${hours} hours`);

    this.reregistrationTimer = setInterval(() => {
      if (!this.isStopped) {
        console.log('Performing periodic re-registration...');
        this.performRegistration();
      }
    }, intervalMs);
  }
}

