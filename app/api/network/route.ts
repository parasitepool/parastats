import { NextResponse } from 'next/server';
import { fetch, fetchText } from '@/lib/http-client';

export const dynamic = 'force-dynamic';

const DEFAULT_CACHE_TTL_MS = 10 * 60_000;

// Read per request (like the refinery routes' ROUTER_API_URL) so tests can
// point the route at a stub upstream.
function mempoolBaseUrl(): string {
  return (process.env.MEMPOOL_API_URL || 'https://mempool.space').replace(/\/+$/, '');
}

function cacheTtlMs(): number {
  const parsed = Number.parseInt(process.env.NETWORK_CACHE_TTL_MS ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_TTL_MS;
}

let cache: { hashrate: number; difficulty: number; height: number | null; timestamp: number } | null = null;

async function getTipHeight(): Promise<number | null> {
  try {
    const text = await fetchText(`${mempoolBaseUrl()}/api/blocks/tip/height`, {
      cache: 'no-store',
      // Capped well below the hashrate request's own timeout, so this parallel
      // fetch can never extend the cold-cache wait by more than 5s.
      timeout: 5_000,
    });
    const height = Number.parseInt(text, 10);
    return Number.isSafeInteger(height) && height > 0 ? height : null;
  } catch {
    return null;
  }
}

// Current Bitcoin network hashrate (H/s), difficulty, and block tip, from mempool.space.
export async function GET() {
  if (cache && Date.now() - cache.timestamp < cacheTtlMs()) {
    return NextResponse.json({ hashrate: cache.hashrate, difficulty: cache.difficulty, height: cache.height });
  }

  try {
    const [res, height] = await Promise.all([
      fetch(`${mempoolBaseUrl()}/api/v1/mining/hashrate/3d`, { cache: 'no-store' }),
      getTipHeight(),
    ]);
    if (!res.ok) throw new Error(`mempool.space failed (${res.status})`);
    const data = await res.json();
    if (typeof data.currentHashrate !== 'number' || typeof data.currentDifficulty !== 'number') {
      throw new Error('Unexpected response shape');
    }
    // A failed tip refresh must never evict a known height: the order modal's
    // hashrate floor depends on it, and a null would degrade it for a full
    // cache TTL.
    const knownHeight = height ?? cache?.height ?? null;
    cache = {
      hashrate: data.currentHashrate,
      difficulty: data.currentDifficulty,
      height: knownHeight,
      timestamp: Date.now(),
    };
    return NextResponse.json({
      hashrate: data.currentHashrate,
      difficulty: data.currentDifficulty,
      height: knownHeight,
    });
  } catch {
    if (cache) {
      return NextResponse.json({
        hashrate: cache.hashrate,
        difficulty: cache.difficulty,
        height: cache.height,
      });
    }
    return NextResponse.json({ error: 'Network data unavailable' }, { status: 502 });
  }
}
