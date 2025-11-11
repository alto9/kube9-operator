import type {
  RegistrationRequest,
  RegistrationResponse,
  ErrorResponse,
} from './types.js';
import {
  UnauthorizedError,
  RateLimitError,
  BadRequestError,
  ServerError,
  TimeoutError,
} from './types.js';

/**
 * HTTP timeout for registration requests (30 seconds)
 */
const REGISTRATION_TIMEOUT_MS = 30000;

/**
 * Registration client for communicating with kube9-server
 * 
 * Handles HTTP POST requests to the registration endpoint with proper
 * authentication, timeout handling, and error management.
 */
export class RegistrationClient {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  /**
   * Creates a new RegistrationClient instance
   * 
   * @param serverUrl - Base URL of kube9-server (e.g., https://api.kube9.dev)
   * @param apiKey - API key for authentication
   * @param timeoutMs - Request timeout in milliseconds (default: 30000)
   */
  constructor(
    serverUrl: string,
    apiKey: string,
    timeoutMs: number = REGISTRATION_TIMEOUT_MS
  ) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Register the operator with kube9-server
   * 
   * Sends a POST request to the registration endpoint with operator metadata.
   * Handles various HTTP status codes and network errors appropriately.
   * 
   * @param request - Registration request data
   * @returns Promise resolving to registration response
   * @throws UnauthorizedError if API key is invalid (401)
   * @throws RateLimitError if rate limit exceeded (429)
   * @throws BadRequestError if request is malformed (400)
   * @throws ServerError for server errors (5xx)
   * @throws TimeoutError if request times out
   * @throws Error for network errors or other failures
   */
  async register(request: RegistrationRequest): Promise<RegistrationResponse> {
    const url = `${this.serverUrl}/v1/operator/register`;

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
          'User-Agent': `kube9-operator/${request.operatorVersion}`,
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      // Handle successful response
      if (response.status === 200) {
        const data = await response.json();
        return data as RegistrationResponse;
      }

      // Handle error responses
      let errorData: ErrorResponse | null = null;
      try {
        errorData = (await response.json()) as ErrorResponse;
      } catch {
        // If response body is not JSON, use default error message
      }

      const errorMessage =
        errorData?.message ||
        `Server returned status ${response.status}`;

      // Handle specific status codes
      if (response.status === 401) {
        throw new UnauthorizedError(errorMessage);
      }

      if (response.status === 429) {
        // Extract Retry-After header if present
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfter = retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : undefined;
        throw new RateLimitError(errorMessage, retryAfter);
      }

      if (response.status === 400) {
        throw new BadRequestError(errorMessage);
      }

      // Handle 5xx server errors
      if (response.status >= 500 && response.status < 600) {
        throw new ServerError(errorMessage, response.status);
      }

      // Handle other status codes
      throw new Error(`Unexpected status code: ${response.status} - ${errorMessage}`);
    } catch (error) {
      // Clear timeout in case of error
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          `Registration request timed out after ${this.timeoutMs}ms`
        );
      }

      // Re-throw known registration errors
      if (
        error instanceof UnauthorizedError ||
        error instanceof RateLimitError ||
        error instanceof BadRequestError ||
        error instanceof ServerError ||
        error instanceof TimeoutError
      ) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Network error: Failed to connect to ${url} - ${error.message}`
        );
      }

      // Re-throw other errors
      throw error;
    }
  }
}

