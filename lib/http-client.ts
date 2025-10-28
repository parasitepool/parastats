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
  MAX_CONNECTIONS: parseInt(process.env.HTTP2_MAX_CONNECTIONS || '20'),
  // Time to live for connections in milliseconds (graceful shutdown after this time)
  CLIENT_TTL: parseInt(process.env.HTTP2_CLIENT_TTL || '60000'),
} as const;

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
    });
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
export const fetch = (
  input: string | URL | Request,
  init?: RequestInit
) => {
  // @ts-expect-error - Type mismatch between DOM and Undici types, but they are compatible at runtime
  return undiciFetch(input, {
    ...init,
    dispatcher: http2Agent,
  }) as unknown as Promise<Response>;
};

/**
 * Export the agent for advanced use cases where direct access is needed
 */
export { http2Agent };
