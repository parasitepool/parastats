import { getDb } from './db';
import { fetch, HttpError, isRetryableError } from './http-client';
import type { BadgesPayload } from './badge-types';

// How long a cached badge payload is considered fresh before we re-fetch from
// the para server. Badges only change when the pool finds a block, so a short
// TTL is plenty; the canonical value is always recomputed upstream at block-find.
const BADGES_CACHE_TTL_SECONDS = 300; // 5 minutes

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 500;
const FETCH_TIMEOUT = 15_000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getApiHeaders(): { url: string; headers: Record<string, string> } {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    throw new Error('No API_URL defined in env');
  }
  const headers: Record<string, string> = {};
  if (process.env.API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
  }
  return { url: apiUrl, headers };
}

async function withRetry<T>(operation: () => Promise<T>, context?: string): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        const backoffDelay = RETRY_BASE_DELAY + attempt * RETRY_BASE_DELAY;
        const jitter = Math.random() + 0.5;
        const contextMsg = context ? ` [${context}]` : '';
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Retry ${attempt + 1}/${MAX_RETRIES} after ${Math.floor(backoffDelay * jitter)}ms${contextMsg} - ${errorMsg}`);
        await delay(Math.floor(backoffDelay * jitter));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Fetch the canonical badge payload for an address from the para server.
 * Returns null when the account is unknown upstream (404).
 */
export async function fetchBadgesFromApi(address: string): Promise<BadgesPayload | null> {
  const { url: apiUrl, headers } = getApiHeaders();

  return withRetry(async () => {
    const url = `${apiUrl}/badges/${encodeURIComponent(address)}`;
    const response = await fetch(url, { headers, timeout: FETCH_TIMEOUT });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url);
    }

    return await response.json() as BadgesPayload;
  }, `GET /badges/${address}`);
}

interface CachedBadges {
  payload: BadgesPayload;
  fetched_at: number;
}

/** Read the cached badge payload for an address, if present. */
export function getCachedBadges(address: string): CachedBadges | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT payload, fetched_at FROM user_badges WHERE address = ?'
  ).get(address) as { payload: string; fetched_at: number } | undefined;

  if (!row) return null;

  try {
    return { payload: JSON.parse(row.payload) as BadgesPayload, fetched_at: row.fetched_at };
  } catch {
    return null;
  }
}

/** Upsert the cached badge payload for an address. */
export function upsertBadges(address: string, payload: BadgesPayload, now: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_badges (address, payload, fetched_at)
    VALUES (?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      payload = excluded.payload,
      fetched_at = excluded.fetched_at
  `).run(address, JSON.stringify(payload), now);
}

/**
 * Return badges for an address using a fetch-through cache: serve fresh cache,
 * otherwise fetch from para and update the cache. On upstream error, fall back
 * to any stale cache rather than failing the request.
 */
export async function getBadgesCached(address: string): Promise<BadgesPayload | null> {
  const now = Math.floor(Date.now() / 1000);
  const cached = getCachedBadges(address);

  if (cached && now - cached.fetched_at < BADGES_CACHE_TTL_SECONDS) {
    return cached.payload;
  }

  try {
    const payload = await fetchBadgesFromApi(address);
    if (payload) {
      upsertBadges(address, payload, now);
      return payload;
    }
    // Upstream reports no account; return the empty/absent state.
    return cached?.payload ?? null;
  } catch (error) {
    console.error(`Error fetching badges for ${address}:`, error);
    // Fall back to stale cache when upstream is unavailable.
    return cached?.payload ?? null;
  }
}
