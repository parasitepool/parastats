import { NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const CONFIG = {
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS: 200,
  MAX_ENTRIES: 10_000,
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  maxEntries?: number;
}

export function getClientIdentifier(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown-client';
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? CONFIG.WINDOW_MS;
  const defaultMaxRequests = options.maxRequests ?? CONFIG.MAX_REQUESTS;
  const maxEntries = options.maxEntries ?? CONFIG.MAX_ENTRIES;
  const store = new Map<string, RateLimitEntry>();

  const pruneExpired = (now: number) => {
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) {
        store.delete(key);
      }
    }
  };

  const check = (
    identifierOrRequest: string | Request,
    maxRequests: number = defaultMaxRequests,
  ): RateLimitResult => {
    const identifier =
      typeof identifierOrRequest === 'string'
        ? identifierOrRequest
        : getClientIdentifier(identifierOrRequest);

    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || entry.resetTime < now) {
      if (entry) {
        store.delete(identifier);
      } else if (store.size >= maxEntries) {
        pruneExpired(now);
        while (store.size >= maxEntries) {
          const oldest = store.keys().next().value;
          if (oldest === undefined) break;
          store.delete(oldest);
        }
      }

      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(identifier, newEntry);

      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        reset: newEntry.resetTime,
      };
    }

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
  };

  return {
    check,
    pruneExpired,
    size: () => store.size,
  };
}

const defaultLimiter = createRateLimiter();

let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    defaultLimiter.pruneExpired(Date.now());
  }, CONFIG.CLEANUP_INTERVAL_MS);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

startCleanup();

export function checkRateLimit(
  identifierOrRequest: string | Request,
  maxRequests: number = CONFIG.MAX_REQUESTS,
): RateLimitResult {
  return defaultLimiter.check(identifierOrRequest, maxRequests);
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

export function rateLimitResponse(
  request: Request,
  maxRequests: number,
  bucket: string,
): NextResponse | null {
  const result = checkRateLimit(`${getClientIdentifier(request)}:${bucket}`, maxRequests);
  if (result.success) return null;

  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: {
        ...getRateLimitHeaders(result),
        'Cache-Control': 'no-store',
      },
    },
  );
}
