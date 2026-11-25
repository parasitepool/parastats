interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 1000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  shouldCache: (data: T) => boolean = () => true,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.data as T;
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const data = await fetcher();
      if (shouldCache(data)) {
        cache.delete(key);
        if (cache.size >= MAX_ENTRIES) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        cache.set(key, { data, expiresAt: Date.now() + ttlMs });
      }
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function invalidateRouteCache(prefixes: readonly string[]): void {
  for (const key of cache.keys()) {
    if (prefixes.some(prefix => key.startsWith(prefix))) {
      cache.delete(key);
    }
  }
}
