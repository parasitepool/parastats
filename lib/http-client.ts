import { Agent, Pool, fetch as undiciFetch, type Dispatcher } from 'undici';

/**
 * HTTP/2-enabled HTTP client using Undici
 *
 * This provides a fetch() implementation with HTTP/2 support and connection pooling
 * for improved performance when making multiple concurrent requests to the same origin.
 *
 * Benefits:
 * - HTTP/2 multiplexing: Multiple requests share the same connection
 * - Connection pooling: Reuse TCP/TLS connections across requests
 * - Reduced latency: No repeated TLS handshakes
 * - Better resource utilization: Fewer connections needed for high concurrency
 */

// Configuration from environment variables with sensible defaults
const CONFIG = {
  // Maximum number of concurrent connections per origin
  MAX_CONNECTIONS: parseInt(process.env.HTTP2_MAX_CONNECTIONS || '30'),
  // Time to live for connections in milliseconds (graceful shutdown after this time)
  // Default: 120s to ensure connections survive between 1-minute cron cycles
  CLIENT_TTL: parseInt(process.env.HTTP2_CLIENT_TTL || '120000'),
  // Connection timeout in milliseconds (time to establish initial connection)
  CONNECT_TIMEOUT: parseInt(process.env.HTTP2_CONNECT_TIMEOUT || '1500'),
  // Headers timeout in milliseconds (time to receive response headers)
  HEADERS_TIMEOUT: parseInt(process.env.HTTP2_HEADERS_TIMEOUT || '10000'),
  // Body timeout in milliseconds (time to receive response body)
  BODY_TIMEOUT: parseInt(process.env.HTTP2_BODY_TIMEOUT || '10000'),
  // Keep-alive timeout in milliseconds (should match server's keep-alive setting)
  KEEPALIVE_TIMEOUT: parseInt(process.env.HTTP2_KEEPALIVE_TIMEOUT || '60000'),
  // Hard timeout for entire request duration (abort via AbortController)
  REQUEST_TIMEOUT: parseInt(process.env.HTTP2_REQUEST_TIMEOUT || '30000'),
  // Maximum retry attempts for ClientDestroyedError
  MAX_RETRIES: parseInt(process.env.HTTP2_MAX_RETRIES || '2'),
  // Delay between retries in milliseconds
  RETRY_DELAY: parseInt(process.env.HTTP2_RETRY_DELAY || '100'),
} as const;

/**
 * Track active requests for graceful shutdown
 */
let activeRequests = 0;
let isShuttingDown = false;
const activeRequestCallbacks = new Set<() => void>();

/**
 * Create a singleton HTTP/2-enabled Agent for connection pooling
 * This agent is reused across all fetch calls to benefit from connection reuse
 */
const http2Agent: Dispatcher = new Agent({
  factory(origin: string | URL, opts: Agent.Options): Dispatcher {
    return new Pool(origin, {
      ...opts,
      // Maximum number of concurrent connections in the pool
      connections: CONFIG.MAX_CONNECTIONS,
      // Enable HTTP/2 support (will upgrade if server supports it)
      allowH2: true,
      // Gracefully close connections after this time to avoid GOAWAY frames
      clientTtl: CONFIG.CLIENT_TTL,
      // Connection timeout (time to establish initial connection)
      connect: {
        timeout: CONFIG.CONNECT_TIMEOUT,
        keepAlive: true,
        keepAliveInitialDelay: 1000,
      },
      // Server's keep-alive timeout (should match server setting)
      keepAliveTimeout: CONFIG.KEEPALIVE_TIMEOUT,
      // Timeout for receiving response headers
      headersTimeout: CONFIG.HEADERS_TIMEOUT,
      // Timeout for receiving response body
      bodyTimeout: CONFIG.BODY_TIMEOUT,
    });
  },
});

/**
 * Check if an error is a ClientDestroyedError
 */
function isClientDestroyedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ('code' in error && error.code === 'UND_ERR_DESTROYED')
  );
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HTTP/2-enabled fetch function with automatic retry on ClientDestroyedError
 * Drop-in replacement for native fetch() with HTTP/2 connection pooling
 *
 * @param input - URL or Request object
 * @param init - Optional RequestInit configuration
 * @returns Promise<Response>
 *
 * @example
 * // Basic usage (same as native fetch)
 * const response = await fetch('https://api.example.com/data');
 * const data = await response.json();
 *
 * @example
 * // With headers and options
 * const response = await fetch('https://api.example.com/data', {
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 */
type ExtendedRequestInit = RequestInit & { 
  timeout?: number;
  maxRetries?: number;
};

export const fetch = async (
  input: string | URL | Request,
  init?: ExtendedRequestInit
): Promise<Response> => {
  // Don't start new requests during shutdown
  if (isShuttingDown) {
    throw new Error('HTTP client is shutting down');
  }

  const maxRetries = init?.maxRetries ?? CONFIG.MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Track this request
    activeRequests++;

    try {
      const response = await fetchWithTimeout(input, init);
      return response;
    } catch (error) {
      lastError = error;

      // Only retry on ClientDestroyedError
      if (isClientDestroyedError(error) && attempt < maxRetries) {
        console.warn(
          `ClientDestroyedError on attempt ${attempt + 1}/${maxRetries + 1}, retrying...`
        );
        await sleep(CONFIG.RETRY_DELAY * (attempt + 1)); // Exponential backoff
        continue;
      }

      // Don't retry other errors
      throw error;
    } finally {
      // Decrement active requests and notify waiters
      activeRequests--;
      if (activeRequests === 0) {
        activeRequestCallbacks.forEach(cb => cb());
        activeRequestCallbacks.clear();
      }
    }
  }

  throw lastError;
};

/**
 * Internal fetch implementation with timeout handling
 */
function fetchWithTimeout(
  input: string | URL | Request,
  init?: ExtendedRequestInit
): Promise<Response> {
  // Remove maxRetries from init by creating a copy without it
  const initCopy = init ? { ...init } : {};
  if ('maxRetries' in initCopy) {
    delete (initCopy as Partial<ExtendedRequestInit>).maxRetries;
  }
  
  const {
    timeout: timeoutOverride,
    signal: userSignal,
    ...restInit
  } = initCopy;

  const controller = new AbortController();
  const timeoutMs = timeoutOverride ?? CONFIG.REQUEST_TIMEOUT;

  let timeoutHandle: NodeJS.Timeout | undefined;
  let removeUserSignalListener: (() => void) | undefined;

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      const onAbort = () => controller.abort(userSignal.reason);
      userSignal.addEventListener('abort', onAbort, { once: true });
      removeUserSignalListener = () => userSignal.removeEventListener('abort', onAbort);
    }
  }

  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    timeoutHandle.unref?.();
  }

  const cleanup = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    removeUserSignalListener?.();
  };

  // @ts-expect-error - Type mismatch between DOM and Undici types, but they are compatible at runtime
  return undiciFetch(input, {
    ...restInit,
    dispatcher: http2Agent,
    signal: controller.signal,
  }).finally(cleanup) as unknown as Promise<Response>;
}

/**
 * Wait for all active requests to complete
 * Used during graceful shutdown
 */
export async function waitForActiveRequests(timeoutMs = 5000): Promise<void> {
  if (activeRequests === 0) {
    return;
  }

  console.log(`Waiting for ${activeRequests} active HTTP requests to complete...`);

  const startTime = Date.now();
  
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (activeRequests === 0) {
        clearInterval(checkInterval);
        console.log('All HTTP requests completed');
        resolve();
      } else if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        console.warn(
          `Timeout waiting for HTTP requests. ${activeRequests} requests still active.`
        );
        resolve();
      }
    }, 100);
  });
}

/**
 * Gracefully shutdown the HTTP client
 * Waits for active requests to complete, then closes the agent
 */
export async function shutdownHttpClient(timeoutMs = 5000): Promise<void> {
  isShuttingDown = true;
  
  await waitForActiveRequests(timeoutMs);
  
  try {
    await http2Agent.close();
    console.log('HTTP client closed successfully');
  } catch (error) {
    console.error('Error closing HTTP client:', error);
  }
}

/**
 * Get the number of currently active requests
 */
export function getActiveRequestCount(): number {
  return activeRequests;
}

/**
 * Export the agent for advanced use cases where direct access is needed
 */
export { http2Agent };
