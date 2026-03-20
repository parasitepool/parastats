interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await fetcher();
    cache.set(key, { data, cachedAt: Date.now() });
    return { data, fromCache: false };
  } catch (error) {
    const cached = cache.get(key) as CacheEntry<T> | undefined;
    if (cached) {
      const ageSeconds = Math.round((Date.now() - cached.cachedAt) / 1000);
      console.warn(
        `[aggregator-cache] Fetch failed for "${key}", using cached data (${ageSeconds}s old):`,
        error instanceof Error ? error.message : error,
      );
      return { data: cached.data, fromCache: true };
    }
    // No cached fallback available — rethrow
    throw error;
  }
}
