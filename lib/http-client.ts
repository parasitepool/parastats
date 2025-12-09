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

/**
 * Custom error class for request timeouts
 * Allows distinguishing timeout errors from other abort/network errors
 */
export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly url: string | undefined;

  constructor(timeoutMs: number, url?: string) {
    const urlInfo = url ? ` for ${url}` : '';
    super(`Request timed out after ${timeoutMs}ms${urlInfo}`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.url = url;
  }
}

/**
 * Custom error class for HTTP errors with status codes
 * Provides structured error information for better error handling
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string | undefined;
  public readonly detail: string | undefined;

  constructor(status: number, statusText: string, url?: string, detail?: string) {
    const urlInfo = url ? ` for ${url}` : '';
    const detailInfo = detail ? `: ${detail}` : '';
    super(`HTTP ${status} ${statusText}${urlInfo}${detailInfo}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.detail = detail;
  }

  /**
   * Check if this error is retryable based on HTTP status code
   * 
   * Retryable: 429 (rate limit), 5xx (server errors)
   * Non-retryable: 4xx client errors (except 429)
   */
  get isRetryable(): boolean {
    if (this.status === 429) return true;
    if (this.status >= 500 && this.status < 600) return true;
    return false;
  }
}

/**
 * Parse integer from environment variable with validation and fallback
 */
function parseEnvInt(envValue: string | undefined, defaultValue: number): number {
  if (!envValue) return defaultValue;
  const parsed = parseInt(envValue, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    console.warn(`Invalid env value "${envValue}", using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

// Configuration from environment variables with sensible defaults
const CONFIG = {
  // Maximum number of concurrent connections per origin
  MAX_CONNECTIONS: parseEnvInt(process.env.HTTP2_MAX_CONNECTIONS, 30),
  // Time to live for connections in milliseconds (graceful shutdown after this time)
  // Set to 0 to disable forced client destruction (prevents ClientDestroyedError)
  // The keepAliveTimeout handles idle connection cleanup instead
  CLIENT_TTL: parseEnvInt(process.env.HTTP2_CLIENT_TTL, 0),
  // Connection timeout in milliseconds (time to establish initial connection)
  CONNECT_TIMEOUT: parseEnvInt(process.env.HTTP2_CONNECT_TIMEOUT, 1500),
  // Headers timeout in milliseconds (time to receive response headers)
  HEADERS_TIMEOUT: parseEnvInt(process.env.HTTP2_HEADERS_TIMEOUT, 10000),
  // Body timeout in milliseconds (time to receive response body)
  BODY_TIMEOUT: parseEnvInt(process.env.HTTP2_BODY_TIMEOUT, 10000),
  // Keep-alive timeout in milliseconds (should match server's keep-alive setting)
  KEEPALIVE_TIMEOUT: parseEnvInt(process.env.HTTP2_KEEPALIVE_TIMEOUT, 60000),
  // Hard timeout for entire request duration (abort via AbortController)
  REQUEST_TIMEOUT: parseEnvInt(process.env.HTTP2_REQUEST_TIMEOUT, 18000),
  // Number of retries for connection-level errors (ClientDestroyedError, etc)
  CONNECTION_RETRIES: parseEnvInt(process.env.HTTP2_CONNECTION_RETRIES, 2),
} as const;

/**
 * Global storage for the HTTP/2 agent to persist across module re-evaluations
 * This prevents issues with Next.js HMR and serverless function recycling
 */
const globalForHttp2 = globalThis as typeof globalThis & {
  __http2Agent?: Dispatcher;
  __http2AgentCreatedAt?: number;
};

/**
 * Create a new HTTP/2-enabled Agent
 */
function createAgent(): Dispatcher {
  return new Agent({
    factory(origin: string | URL, opts: Agent.Options): Dispatcher {
      return new Pool(origin, {
        ...opts,
        // Maximum number of concurrent connections in the pool
        connections: CONFIG.MAX_CONNECTIONS,
        // Enable HTTP/2 support (will upgrade if server supports it)
        allowH2: true,
        // Disable forced client destruction (set to 0)
        // This prevents ClientDestroyedError when TTL expires during requests
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
}

/**
 * Get or create the HTTP/2 agent singleton
 * Uses globalThis to persist across module re-evaluations (HMR, serverless recycling)
 */
function getAgent(): Dispatcher {
  if (!globalForHttp2.__http2Agent) {
    globalForHttp2.__http2Agent = createAgent();
    globalForHttp2.__http2AgentCreatedAt = Date.now();
  }
  return globalForHttp2.__http2Agent;
}

/**
 * Force recreation of the agent (called after ClientDestroyedError)
 */
function recreateAgent(): Dispatcher {
  // Close the old agent if it exists (ignore errors)
  if (globalForHttp2.__http2Agent) {
    try {
      (globalForHttp2.__http2Agent as Agent).close();
    } catch {
      // Ignore - agent might already be destroyed
    }
  }
  globalForHttp2.__http2Agent = createAgent();
  globalForHttp2.__http2AgentCreatedAt = Date.now();
  return globalForHttp2.__http2Agent;
}

// For backwards compatibility, expose http2Agent as a getter
const http2Agent: Dispatcher = new Proxy({} as Dispatcher, {
  get(_target, prop) {
    return (getAgent() as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * HTTP/2-enabled fetch function
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
export type ExtendedRequestInit = RequestInit & { 
  /** Request timeout in milliseconds. Set to 0 to disable. Default: CONFIG.REQUEST_TIMEOUT */
  timeout?: number;
  /** If true, throws TimeoutError on timeout instead of generic AbortError */
  throwOnTimeout?: boolean;
};

// Unique symbol to identify our timeout aborts
const TIMEOUT_ABORT_REASON = Symbol('http-client-timeout');

/**
 * Check if an error is a timeout error from this client
 * Handles multiple cases:
 * - TimeoutError instance (our wrapped error)
 * - Raw TIMEOUT_ABORT_REASON symbol (undici may throw the abort reason directly)
 * - AbortError with our symbol as cause
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  // Handle case where undici throws the raw abort reason symbol
  if (error === TIMEOUT_ABORT_REASON) return true;
  if (error instanceof Error) {
    // Check abort errors with our symbol as cause
    if (error.name === 'AbortError') {
      const cause = (error as Error & { cause?: unknown }).cause;
      return cause === TIMEOUT_ABORT_REASON;
    }
    // Check if the error message contains our symbol's description
    if (error.message.includes('http-client-timeout')) return true;
  }
  // Check string representation of the error
  if (typeof error === 'symbol' && error.description === 'http-client-timeout') return true;
  return false;
}

/**
 * Check if an error is a connection/client destroyed error from undici
 * This happens when HTTP/2 sessions are closed while requests are in-flight
 */
export function isClientDestroyedError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check error code (undici sets this)
    const code = (error as Error & { code?: string }).code;
    if (code === 'UND_ERR_DESTROYED') return true;
    
    // Check error name
    if (error.name === 'ClientDestroyedError') return true;
    
    // Check message as fallback
    const msg = error.message.toLowerCase();
    if (msg.includes('client is destroyed') || msg.includes('clientdestroyederror')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx, 429, client destroyed)
 */
export function isRetryableError(error: unknown): boolean {
  // Timeout errors are retryable
  if (isTimeoutError(error)) return true;
  
  // Client destroyed errors are retryable (HTTP/2 session was closed)
  if (isClientDestroyedError(error)) return true;
  
  // HTTP errors - delegate to the error's own logic
  if (error instanceof HttpError) return error.isRetryable;
  
  // Network/connection errors are retryable
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('fetch failed') || 
        msg.includes('network') || 
        msg.includes('econnrefused') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('enotfound') ||
        msg.includes('socket hang up') ||
        msg.includes('aborted')) {
      return true;
    }
    
    // Check undici error codes
    const code = (error as Error & { code?: string }).code;
    if (code && (
      code.startsWith('UND_ERR_') ||  // All undici errors are generally retryable
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND'
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Internal fetch implementation with a specific agent
 */
function doFetch(
  input: string | URL | Request,
  init: ExtendedRequestInit | undefined,
  agent: Dispatcher
): Promise<Response> {
  const {
    timeout: timeoutOverride,
    signal: userSignal,
    throwOnTimeout = true,
    ...restInit
  } = init ?? {};

  const controller = new AbortController();
  const timeoutMs = timeoutOverride ?? CONFIG.REQUEST_TIMEOUT;
  
  // Extract URL for error messages
  const urlString = typeof input === 'string' 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url;

  let timeoutHandle: NodeJS.Timeout | undefined;
  let removeUserSignalListener: (() => void) | undefined;
  let didTimeout = false;

  // Forward user's abort signal to our controller
  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      const onAbort = () => controller.abort(userSignal.reason);
      userSignal.addEventListener('abort', onAbort, { once: true });
      removeUserSignalListener = () => userSignal.removeEventListener('abort', onAbort);
    }
  }

  // Set up timeout with identifiable abort reason
  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      didTimeout = true;
      controller.abort(TIMEOUT_ABORT_REASON);
    }, timeoutMs);
    // Don't keep the process alive just for this timeout
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
    dispatcher: agent,
    signal: controller.signal,
  })
    .catch((error: unknown) => {
      // Transform timeout aborts into TimeoutError for better error handling
      if (didTimeout && throwOnTimeout) {
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        const isRawSymbol = error === TIMEOUT_ABORT_REASON;
        const hasSymbolCause = error instanceof Error && 
          (error as Error & { cause?: unknown }).cause === TIMEOUT_ABORT_REASON;
        
        if (isAbortError || isRawSymbol || hasSymbolCause) {
          throw new TimeoutError(timeoutMs, urlString);
        }
      }
      throw error;
    })
    .finally(cleanup) as unknown as Promise<Response>;
}

/**
 * HTTP/2-enabled fetch with automatic retry for connection errors
 * 
 * When ClientDestroyedError or other connection errors occur, the agent
 * is recreated and the request is retried automatically.
 */
export async function fetch(
  input: string | URL | Request,
  init?: ExtendedRequestInit
): Promise<Response> {
  let lastError: unknown;
  const maxRetries = CONFIG.CONNECTION_RETRIES;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const agent = getAgent();
      return await doFetch(input, init, agent);
    } catch (error) {
      lastError = error;
      
      // Only retry on connection-level errors, not on timeouts or HTTP errors
      if (isClientDestroyedError(error)) {
        // Recreate the agent for the next attempt
        recreateAgent();
        
        if (attempt < maxRetries) {
          // Small delay before retry to let things settle
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }
      }
      
      // For non-connection errors or final attempt, throw immediately
      throw error;
    }
  }
  
  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Convenience wrapper that validates response status and throws HttpError for non-ok responses
 * Includes retry logic for connection errors during body reading
 * 
 * @example
 * const data = await fetchJson<UserData>('https://api.example.com/user/1');
 */
export async function fetchJson<T>(
  input: string | URL | Request,
  init?: ExtendedRequestInit
): Promise<T> {
  const urlString = typeof input === 'string' 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url;

  // Retry the entire operation if body reading fails due to connection issues
  for (let attempt = 0; attempt <= CONFIG.CONNECTION_RETRIES; attempt++) {
    try {
      const response = await fetch(input, init);

      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, urlString);
      }

      return await response.json() as T;
    } catch (error) {
      if (isClientDestroyedError(error) && attempt < CONFIG.CONNECTION_RETRIES) {
        recreateAgent();
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      throw error;
    }
  }
  
  // Should never reach here
  throw new Error('fetchJson: unexpected state');
}

/**
 * Convenience wrapper that validates response status and returns text
 * Includes retry logic for connection errors during body reading
 */
export async function fetchText(
  input: string | URL | Request,
  init?: ExtendedRequestInit
): Promise<string> {
  const urlString = typeof input === 'string' 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url;

  // Retry the entire operation if body reading fails due to connection issues
  for (let attempt = 0; attempt <= CONFIG.CONNECTION_RETRIES; attempt++) {
    try {
      const response = await fetch(input, init);

      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, urlString);
      }

      return await response.text();
    } catch (error) {
      if (isClientDestroyedError(error) && attempt < CONFIG.CONNECTION_RETRIES) {
        recreateAgent();
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      throw error;
    }
  }
  
  // Should never reach here
  throw new Error('fetchText: unexpected state');
}

/**
 * Export the agent for advanced use cases where direct access is needed
 */
export { http2Agent };
