/**
 * Retry utilities for handling HTTP errors and retryable operations
 * 
 * This module provides reusable error handling and retry logic that can be
 * used across different parts of the application (http-client, route handlers, etc.)
 */

/**
 * Custom HTTP error class with status code
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly url?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Check if an error is an abort error
 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.includes('aborted') ||
      error.message.includes('abort'))
  );
}

/**
 * Determine if an HTTP error should be retried
 * 
 * Retryable errors include:
 * - Network errors (connection failures, timeouts)
 * - Transient server errors (500, 502, 503, 504)
 * - Rate limiting (429)
 * - Request timeouts (408)
 * 
 * Non-retryable errors include:
 * - Client errors (400, 401, 403, 404)
 * - Abort errors (user cancelled)
 * - Invalid JSON parsing errors
 */
export function isRetryableError(error: unknown): boolean {
  // Abort errors should not be retried
  if (isAbortError(error)) {
    return false;
  }

  // HttpError with retryable status codes
  if (error instanceof HttpError) {
    const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
    return retryableStatusCodes.has(error.statusCode);
  }

  // Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
  if (error instanceof Error) {
    const networkErrorCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
    ];

    // Check for error codes
    if ('code' in error && typeof error.code === 'string') {
      if (networkErrorCodes.includes(error.code)) {
        return true;
      }

      // Undici-specific errors
      if (error.code === 'UND_ERR_CONNECT_TIMEOUT') return true;
      if (error.code === 'UND_ERR_HEADERS_TIMEOUT') return true;
      if (error.code === 'UND_ERR_BODY_TIMEOUT') return true;
      if (error.code === 'UND_ERR_SOCKET') return true;
    }

    // Check error message for common network issues
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('timeout')) return true;
    if (errorMsg.includes('network')) return true;
    if (errorMsg.includes('econnrefused')) return true;
    if (errorMsg.includes('econnreset')) return true;
    if (errorMsg.includes('socket hang up')) return true;
  }

  // Default to not retrying unknown errors
  return false;
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 100) */
  initialDelay?: number;
  /** Maximum delay between retries in ms (default: 5000) */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Whether to use exponential backoff (default: true) */
  useExponentialBackoff?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback function called before each retry */
  onRetry?: (error: unknown, attempt: number, nextDelay: number) => void;
}

/**
 * Execute an async function with automatic retry on retryable errors
 * 
 * @example
 * const data = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, initialDelay: 100 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
    useExponentialBackoff = true,
    isRetryable = isRetryableError,
    onRetry,
  } = config;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate next delay
      const nextDelay = Math.min(delay, maxDelay);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, nextDelay);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, nextDelay));

      // Update delay for next iteration
      if (useExponentialBackoff) {
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}
