import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cachedJson } from '@/lib/route-cache';
import { formatAddress } from '@/app/utils/formatters';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  SHADOW_BLOCK_MAX_BLOCKS,
  SHADOW_BLOCK_WINDOW_SECONDS,
  type ShadowBlockTopDiff,
} from '@/app/utils/shadow-block';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 15_000;

export async function GET(request: Request) {
  const rateLimitResult = checkRateLimit(request);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    const requestedLimit = Number.parseInt(
      new URL(request.url).searchParams.get('limit') ?? '',
      10,
    );
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), SHADOW_BLOCK_MAX_BLOCKS)
      : SHADOW_BLOCK_MAX_BLOCKS;

    const topDiffs = await cachedJson<ShadowBlockTopDiff[]>(
      `shadow-block:${limit}`,
      CACHE_TTL_MS,
      async () => {
        const db = getDb();
        const cutoff = Math.floor(Date.now() / 1000) - SHADOW_BLOCK_WINDOW_SECONDS;

        const recentBlocks = db.prepare(`
          SELECT block_height, block_timestamp
          FROM block_highest_diff
          WHERE block_timestamp IS NOT NULL AND block_timestamp >= ?
          ORDER BY block_height DESC
          LIMIT ?
        `).all(cutoff, limit) as { block_height: number; block_timestamp: number | null }[];

        const getTopPublicUser = db.prepare(`
          SELECT u.address, u.difficulty
          FROM user_block_diff u
          LEFT JOIN monitored_users m ON m.address = u.address
          WHERE u.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
          ORDER BY u.difficulty DESC
          LIMIT 1
        `);

        return recentBlocks.map((block) => {
          const topUser = getTopPublicUser.get(block.block_height) as
            | { address: string; difficulty: number }
            | undefined;
          return {
            block_height: block.block_height,
            block_timestamp: block.block_timestamp,
            top_diff_address: topUser ? formatAddress(topUser.address) : null,
            difficulty: topUser?.difficulty ?? null,
          };
        });
      },
    );

    return NextResponse.json(topDiffs, {
      headers: {
        ...getRateLimitHeaders(rateLimitResult),
        'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[api/shadow-block] Failed to fetch shadow block top diffs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shadow block top diffs' },
      {
        status: 500,
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
