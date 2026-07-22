import { isRetryableError } from './http-client';
import { parsePositiveInt } from './env';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

// Bound memory: every distinct key (URL) ever requested would otherwise live
// in the Map forever. Oldest entries are evicted once the cap is reached.
const MAX_ENTRIES = parsePositiveInt(process.env.AGGREGATOR_CACHE_MAX_ENTRIES, 500);

// Entries older than this are treated as absent — serving day-old stats is
// worse than surfacing the error. Default 24 hours.
const MAX_STALE_AGE_MS = parsePositiveInt(
  process.env.AGGREGATOR_CACHE_MAX_STALE_MS,
  24 * 60 * 60 * 1000,
);

const cache = new Map<string, CacheEntry<unknown>>();

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await fetcher();
    // Delete before set so re-insertion refreshes the key's position in the
    // Map's insertion order, making eviction approximately LRU
    cache.delete(key);
    if (cache.size >= MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, { data, cachedAt: Date.now() });
    return { data, fromCache: false };
  } catch (error) {
    const cached = cache.get(key) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.cachedAt > MAX_STALE_AGE_MS) {
      cache.delete(key);
    } else if (cached && isRetryableError(error)) {
      // Serve stale data only for transient failures (timeouts, network
      // errors, 5xx). Authoritative answers like a 404 must propagate —
      // masking them with stale data would show departed users forever.
      const ageSeconds = Math.round((Date.now() - cached.cachedAt) / 1000);
      console.warn(
        `[aggregator-cache] Fetch failed for "${key}", using cached data (${ageSeconds}s old):`,
        error instanceof Error ? error.message : error,
      );
      return { data: cached.data, fromCache: true };
    }
    // No cached fallback available (or non-transient error) — rethrow
    throw error;
  }
}
