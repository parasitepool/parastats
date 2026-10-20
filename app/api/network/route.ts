import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 10 * 60_000;
let cache: { hashrate: number; difficulty: number; timestamp: number } | null = null;

// Current Bitcoin network hashrate (H/s) and difficulty, from mempool.space.
export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ hashrate: cache.hashrate, difficulty: cache.difficulty });
  }

  try {
    const res = await fetch('https://mempool.space/api/v1/mining/hashrate/3d', { cache: 'no-store' });
    if (!res.ok) throw new Error(`mempool.space failed (${res.status})`);
    const data = await res.json();
    if (typeof data.currentHashrate !== 'number' || typeof data.currentDifficulty !== 'number') {
      throw new Error('Unexpected response shape');
    }
    cache = { hashrate: data.currentHashrate, difficulty: data.currentDifficulty, timestamp: Date.now() };
    return NextResponse.json({ hashrate: data.currentHashrate, difficulty: data.currentDifficulty });
  } catch {
    if (cache) return NextResponse.json({ hashrate: cache.hashrate, difficulty: cache.difficulty });
    return NextResponse.json({ error: 'Network data unavailable' }, { status: 502 });
  }
}
