/**
 * Generic endpoint discovery utilities
 * 
 * This module provides a flexible pattern for discovering API endpoints
 * by trying multiple possible paths. It consolidates what were previously
 * 4 separate discovery functions into a single, configurable approach.
 */

import { fetch } from './http-client';

/**
 * Configuration for endpoint discovery
 */
export interface EndpointDiscoveryConfig {
  /** Descriptive name for logging (e.g., "pool users", "user stats") */
  name: string;
  /** List of possible endpoint paths to try */
  possiblePaths: string[];
  /** Base API URL */
  apiUrl: string;
  /** Request headers (e.g., Authorization) */
  headers: Record<string, string>;
  /** Placeholder for dynamic parts (e.g., "{address}" for user-specific endpoints) */
  placeholder?: string;
  /** Timeout for discovery requests in ms (default: 5000) */
  timeout?: number;
  /** Whether to validate response body (default: false) */
  validateResponse?: (response: Response) => Promise<boolean>;
}

/**
 * Discover the correct API endpoint by trying multiple possible paths
 * 
 * This generic function replaces multiple similar discovery functions by
 * accepting configuration that specifies what to discover and how.
 * 
 * @example
 * // Discover pool users endpoint
 * const path = await discoverEndpoint({
 *   name: 'pool users',
 *   possiblePaths: [
 *     '/aggregator/pool/users',
 *     '/pool/users',
 *     '/api/pool/users'
 *   ],
 *   apiUrl: 'https://api.example.com',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * 
 * @example
 * // Discover user stats endpoint with placeholder
 * const path = await discoverEndpoint({
 *   name: 'user stats',
 *   possiblePaths: [
 *     '/aggregator/pool/{address}',
 *     '/pool/user/{address}',
 *     '/api/user/{address}'
 *   ],
 *   apiUrl: 'https://api.example.com',
 *   headers: {},
 *   placeholder: '{address}'
 * });
 */
export async function discoverEndpoint(
  config: EndpointDiscoveryConfig
): Promise<string> {
  const {
    name,
    possiblePaths,
    apiUrl,
    headers,
    timeout = 5000,
    validateResponse,
  } = config;

  for (const path of possiblePaths) {
    try {
      // Build the test URL
      const testUrl = `${apiUrl}${path}`;

      // Make the request
      const response = await fetch(testUrl, {
        headers,
        timeout,
      });

      // Check if response is OK
      if (!response.ok) {
        continue;
      }

      // Optional: Validate response body
      if (validateResponse) {
        const isValid = await validateResponse(response);
        if (!isValid) {
          continue;
        }
      }

      // Success! Log and return the path
      console.log(`✓ Discovered ${name} endpoint: ${path}`);

      // If there's a placeholder, return the template path
      // Otherwise return the actual path
      return path;
    } catch {
      // Continue to next path on any error
      continue;
    }
  }

  // If we get here, no endpoint was found
  throw new Error(`Could not discover ${name} endpoint. Tried paths: ${possiblePaths.join(', ')}`);
}

/**
 * Cache for discovered endpoints to avoid repeated discovery
 */
const endpointCache = new Map<string, string>();

/**
 * Discover an endpoint with caching
 * 
 * This wrapper around discoverEndpoint() caches successful discoveries
 * to avoid redundant network requests on subsequent calls.
 * 
 * @param cacheKey - Unique key for this endpoint in the cache
 * @param config - Discovery configuration
 * @returns The discovered endpoint path
 */
export async function discoverEndpointCached(
  cacheKey: string,
  config: EndpointDiscoveryConfig
): Promise<string> {
  // Check cache first
  const cached = endpointCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Discover and cache
  const endpoint = await discoverEndpoint(config);
  endpointCache.set(cacheKey, endpoint);

  return endpoint;
}

/**
 * Clear the endpoint cache
 * Useful for testing or when endpoints change
 */
export function clearEndpointCache(): void {
  endpointCache.clear();
}

/**
 * Remove a specific endpoint from cache
 * Useful when an endpoint stops working and needs rediscovery
 */
export function invalidateEndpoint(cacheKey: string): void {
  endpointCache.delete(cacheKey);
}

/**
 * Get all cached endpoints (for debugging)
 */
export function getCachedEndpoints(): Record<string, string> {
  return Object.fromEntries(endpointCache);
}

// Pre-configured discovery functions for common use cases
// These provide convenient wrappers while using the generic pattern

/**
 * Common endpoint paths for pool users
 */
export const POOL_USERS_PATHS = [
  '/aggregator/pool/users',
  '/pool/users',
  '/api/pool/users',
  '/users',
];

/**
 * Common endpoint paths for pool stats
 */
export const POOL_STATS_PATHS = [
  '/aggregator/pool/pool.status',
  '/pool/pool.status',
  '/api/pool/pool.status',
  '/pool.status',
  '/pool/status',
];

/**
 * Common endpoint paths for user stats (with {address} placeholder)
 */
export const USER_STATS_PATHS = [
  '/aggregator/users/{address}',
  '/users/{address}',
  '/api/users/{address}',
];

/**
 * Discover pool users endpoint
 */
export async function discoverPoolUsersEndpoint(
  apiUrl: string,
  headers: Record<string, string>
): Promise<string> {
  return discoverEndpointCached('pool-users', {
    name: 'pool users',
    possiblePaths: POOL_USERS_PATHS,
    apiUrl,
    headers,
  });
}

/**
 * Discover pool stats endpoint
 */
export async function discoverPoolStatsEndpoint(
  apiUrl: string,
  headers: Record<string, string>
): Promise<string> {
  return discoverEndpointCached('pool-stats', {
    name: 'pool stats',
    possiblePaths: POOL_STATS_PATHS,
    apiUrl,
    headers,
  });
}

/**
 * Discover user stats endpoint (returns template with {address} placeholder)
 */
export async function discoverUserStatsEndpoint(
  apiUrl: string,
  headers: Record<string, string>,
  testAddress: string
): Promise<string> {
  // Replace placeholder with test address for discovery
  const pathsWithAddress = USER_STATS_PATHS.map((path) =>
    path.replace('{address}', testAddress)
  );

  const discovered = await discoverEndpoint({
    name: 'user stats',
    possiblePaths: pathsWithAddress,
    apiUrl,
    headers,
  });

  // Convert back to template format
  return discovered.replace(testAddress, '{address}');
}

/**
 * Get user stats endpoint with promise caching for concurrent requests
 * 
 * This function ensures that if multiple requests try to discover the
 * endpoint simultaneously, only one discovery is performed.
 */
let userStatsEndpointPromise: Promise<string> | null = null;

export async function getUserStatsEndpoint(
  apiUrl: string,
  headers: Record<string, string>,
  testAddress: string
): Promise<string> {
  // Check cache first
  const cached = endpointCache.get('user-stats');
  if (cached) {
    return cached;
  }

  // If discovery is already in progress, wait for it
  if (userStatsEndpointPromise) {
    return userStatsEndpointPromise;
  }

  // Start new discovery
  userStatsEndpointPromise = discoverUserStatsEndpoint(
    apiUrl,
    headers,
    testAddress
  );

  try {
    const endpoint = await userStatsEndpointPromise;
    endpointCache.set('user-stats', endpoint);
    return endpoint;
  } finally {
    userStatsEndpointPromise = null;
  }
}
