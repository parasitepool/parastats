import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  SHADOW_BLOCK_MAX_BLOCKS,
  SHADOW_BLOCK_WINDOW_SECONDS,
  type ShadowBlockTopDiff,
} from '@/app/utils/shadow-block';

export const dynamic = 'force-dynamic';

interface ShadowBlockTopDiffDBRow {
  block_height: number;
  block_timestamp: number | null;
  address: string | null;
  difficulty: number | null;
}

/**
 * PRIVACY: This API only returns truncated addresses.
 */
export async function GET(request: Request) {
  const rateLimitResult = checkRateLimit(request);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  try {
    const db = getDb();
    const cutoff = Math.floor(Date.now() / 1000) - SHADOW_BLOCK_WINDOW_SECONDS;
    const requestedLimit = Number.parseInt(
      new URL(request.url).searchParams.get('limit') ?? '',
      10,
    );
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), SHADOW_BLOCK_MAX_BLOCKS)
      : SHADOW_BLOCK_MAX_BLOCKS;

    const rows = db.prepare(`
      WITH recent AS (
        SELECT block_height, block_timestamp
        FROM block_highest_diff
        WHERE block_timestamp IS NOT NULL AND block_timestamp >= ?
        ORDER BY block_height DESC
        LIMIT ?
      ),
      ranked AS (
        SELECT
          u.block_height,
          u.address,
          u.difficulty,
          ROW_NUMBER() OVER (
            PARTITION BY u.block_height
            ORDER BY u.difficulty DESC
          ) AS rn
        FROM user_block_diff u
        INNER JOIN recent r ON r.block_height = u.block_height
        LEFT JOIN monitored_users m ON m.address = u.address
        WHERE m.is_public = 1 OR m.address IS NULL
      )
      SELECT
        r.block_height,
        r.block_timestamp,
        ranked.address,
        ranked.difficulty
      FROM recent r
      LEFT JOIN ranked ON ranked.block_height = r.block_height AND ranked.rn = 1
      ORDER BY r.block_height DESC
    `).all(cutoff, limit) as ShadowBlockTopDiffDBRow[];

    const topDiffs: ShadowBlockTopDiff[] = rows.map((row) => ({
      block_height: row.block_height,
      block_timestamp: row.block_timestamp,
      top_diff_address: row.address ? formatAddress(row.address) : null,
      difficulty: row.difficulty,
    }));

    return NextResponse.json(topDiffs, {
      headers: {
        ...getRateLimitHeaders(rateLimitResult),
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[api/shadow-block] Failed to fetch shadow block top diffs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shadow block top diffs' },
      { status: 500, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }
}
