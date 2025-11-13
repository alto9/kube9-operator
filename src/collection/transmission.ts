/**
 * Transmission client for sending collection data to kube9-server (Pro Tier)
 * 
 * Handles HTTP POST requests to transmit collection payloads with retry logic,
 * exponential backoff, and graceful error handling. All errors are logged
 * internally and never thrown to ensure graceful degradation.
 */

import type { CollectionPayload } from './types.js';
import { logger } from '../logging/logger.js';

/**
 * HTTP timeout for transmission requests (30 seconds)
 */
const TRANSMISSION_TIMEOUT_MS = 30000;

/**
 * Exponential backoff delays in milliseconds for retries
 * Used for network errors, timeouts, and server errors (5xx)
 */
const BACKOFF_DELAYS_MS = [
  1000,  // 1 second
  2000,  // 2 seconds
  4000,  // 4 seconds
];

/**
 * Maximum number of retry attempts
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * TransmissionClient handles HTTP transmission of collection payloads to kube9-server.
 * 
 * Designed for pro tier operators to send sanitized, validated collection data.
 * Implements retry logic with exponential backoff and graceful error handling
 * (errors are logged, not thrown) to ensure the operator continues operating
 * even when the server is unreachable.
 */
export class TransmissionClient {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  /**
   * Creates a new TransmissionClient instance
   * 
   * @param serverUrl - Base URL of kube9-server (e.g., https://api.kube9.dev)
   * @param apiKey - API key for authentication
   * @param timeoutMs - Request timeout in milliseconds (default: 30000)
   */
  constructor(
    serverUrl: string,
    apiKey: string,
    timeoutMs: number = TRANSMISSION_TIMEOUT_MS
  ) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Transmits a collection payload to kube9-server
   * 
   * Sends a POST request to the collections endpoint with retry logic.
   * All errors are caught and logged internally - no exceptions are thrown
   * to ensure graceful degradation when the server is unreachable.
   * 
   * @param payload - Collection payload to transmit
   * @returns Promise that resolves when transmission completes (or fails gracefully)
   */
  async transmit(payload: CollectionPayload): Promise<void> {
    const collectionId = payload.data.collectionId;
    const collectionType = payload.type;
    const url = `${this.serverUrl}/v1/collections`;

    logger.info('Starting collection transmission', {
      collectionId,
      type: collectionType,
      url,
    });

    // Attempt transmission with retries
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.attemptTransmission(url, payload, attempt);
        
        // Success - log and return
        logger.info('Collection transmission successful', {
          collectionId,
          type: collectionType,
          attempt,
        });
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS;
        const shouldRetry = this.shouldRetry(error, attempt);

        if (isLastAttempt || !shouldRetry) {
          // Final failure - log error and return (graceful degradation)
          logger.error('Collection transmission failed after retries', {
            collectionId,
            type: collectionType,
            attempt,
            maxAttempts: MAX_RETRY_ATTEMPTS,
            error: errorMessage,
          });
          return;
        }

        // Retry - log warning and wait before next attempt
        const backoffDelay = BACKOFF_DELAYS_MS[attempt - 1] || BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
        logger.warn('Collection transmission failed, retrying with exponential backoff', {
          collectionId,
          type: collectionType,
          attempt,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          error: errorMessage,
          retryAfterMs: backoffDelay,
        });

        // Wait for backoff delay before retrying
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  /**
   * Attempts a single transmission request
   * 
   * @param url - Full URL to POST to
   * @param payload - Collection payload to send
   * @param attempt - Current attempt number (for logging)
   * @throws Error for network errors, timeouts, or HTTP errors
   */
  private async attemptTransmission(
    url: string,
    payload: CollectionPayload,
    attempt: number
  ): Promise<void> {
    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      // Handle successful response
      if (response.ok) {
        return;
      }

      // Handle error responses
      let errorMessage = `Server returned status ${response.status}`;
      try {
        const errorData = await response.json() as { message?: string };
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If response body is not JSON, use default error message
      }

      // Create error with status code for retry decision
      const error = new Error(errorMessage) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    } catch (error) {
      // Clear timeout in case of error
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Transmission request timed out after ${this.timeoutMs}ms`);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error: Failed to connect to ${url} - ${error.message}`);
      }

      // Re-throw other errors (will be caught by retry logic)
      throw error;
    }
  }

  /**
   * Determines if an error should trigger a retry
   * 
   * Retries on: network errors, timeouts, 5xx server errors
   * Does NOT retry on: 4xx client errors (400, 401, 429)
   * 
   * @param error - Error that occurred
   * @param attempt - Current attempt number
   * @returns true if should retry, false otherwise
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    // Don't retry if we've exceeded max attempts
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      return false;
    }

    // Check if error has statusCode property (HTTP error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode;

    if (statusCode !== undefined) {
      // Don't retry on 4xx client errors
      if (statusCode >= 400 && statusCode < 500) {
        return false;
      }

      // Retry on 5xx server errors
      if (statusCode >= 500 && statusCode < 600) {
        return true;
      }
    }

    // Retry on network errors and timeouts (no statusCode)
    // These are typically TypeError (fetch failed) or timeout errors
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Network error')) {
        return true;
      }
    }

    // Default: retry on unknown errors (conservative approach)
    return true;
  }
}

