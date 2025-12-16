/**
 * Simple in-memory rate limiter for API routes
 * 
 * Note: This is a basic implementation suitable for single-instance deployments.
 * For production with multiple instances, consider using Redis or a similar
 * distributed store for rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const CONFIG = {
  WINDOW_MS: 60 * 1000, // 1 minute window
  MAX_REQUESTS: 100, // Max requests per window
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // Cleanup every 5 minutes
} as const;

// Periodic cleanup of expired entries to prevent memory leaks
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CONFIG.CLEANUP_INTERVAL_MS);
  
  // Don't keep process alive just for cleanup
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// Start cleanup on module load
startCleanup();

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the client (e.g., IP address)
 * @param maxRequests - Optional custom max requests (defaults to CONFIG.MAX_REQUESTS)
 * @returns Rate limit result with success status and metadata
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = CONFIG.MAX_REQUESTS
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If no entry or window has expired, create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + CONFIG.WINDOW_MS,
    };
    rateLimitStore.set(identifier, newEntry);
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: newEntry.resetTime,
    };
  }

  // Increment count and check limit
  entry.count++;
  
  if (entry.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header if behind a proxy, falls back to generic identifier
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from common headers (when behind proxy/load balancer)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback - in development or when headers aren't available
  return 'unknown-client';
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

