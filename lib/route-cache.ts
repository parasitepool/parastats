interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// Bound memory: every distinct key (query combo) ever requested would
// otherwise live in the Map forever. Oldest entries are evicted once the cap
// is reached.
const MAX_ENTRIES = 200;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Short-TTL in-memory cache for proxy GET routes. All concurrent requests for
 * a key share a single upstream fetch (in-flight dedup), so any number of
 * polling clients collapses to at most one upstream request per TTL window.
 * If a refresh fails, the stale entry is served rather than erroring.
 */
export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const data = await fetcher();
      // Delete before set so re-insertion refreshes the key's position in the
      // Map's insertion order, making eviction approximately LRU.
      cache.delete(key);
      if (cache.size >= MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) cache.delete(oldestKey);
      }
      cache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data;
    } catch (error) {
      const stale = cache.get(key);
      if (stale) {
        console.warn(`[route-cache] Refresh failed for "${key}", serving stale data:`, error);
        return stale.data as T;
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}
