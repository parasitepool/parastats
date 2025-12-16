import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  MAX_BLOCK_HEIGHT,
  MAX_USERS_PER_BLOCK,
  BlockHighestDiffRow,
  UserBlockDiffRow,
  logError,
} from '../types';

/**
 * PRIVACY: This API only returns truncated addresses.
 * Full addresses are never exposed to protect user privacy.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ blockheight: string }> }
) {
  // Rate limiting - pass Request directly, identifier extracted internally
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
    const { blockheight } = await params;
    const blockHeight = parseInt(blockheight, 10);

    // Validate block height with upper bound to prevent resource exhaustion
    // See types.ts for explanation of MAX_BLOCK_HEIGHT
    if (isNaN(blockHeight) || blockHeight < 0 || blockHeight > MAX_BLOCK_HEIGHT) {
      return NextResponse.json(
        { error: 'Invalid block height' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const db = getDb();

    // Get the top diff (watermark) for this block
    // Note: DB column is winner_address, aliased for API consistency
    const topDiff = db.prepare(`
      SELECT 
        block_height,
        winner_address as top_diff_address,
        difficulty,
        block_timestamp
      FROM block_highest_diff
      WHERE block_height = ?
    `).get(blockHeight) as BlockHighestDiffRow | undefined;

    if (!topDiff) {
      return NextResponse.json(
        { error: 'No data found for this block' },
        { status: 404, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    // Get all user diffs for this block with LIMIT to prevent unbounded queries
    const userDiffs = db.prepare(`
      SELECT 
        address,
        difficulty
      FROM user_block_diff
      WHERE block_height = ?
      ORDER BY difficulty DESC
      LIMIT ?
    `).all(blockHeight, MAX_USERS_PER_BLOCK) as UserBlockDiffRow[];

    // Return only truncated addresses - never expose full addresses
    return NextResponse.json({
      block_height: topDiff.block_height,
      block_timestamp: topDiff.block_timestamp,
      top_diff: {
        address: formatAddress(topDiff.top_diff_address), // Truncated only
        difficulty: topDiff.difficulty,
      },
      users: userDiffs.map(u => ({
        address: formatAddress(u.address), // Truncated only
        difficulty: u.difficulty,
      })),
      user_count: userDiffs.length,
    }, { headers: getRateLimitHeaders(rateLimitResult) });

  } catch (error) {
    logError('highest-diff/[blockheight]/route', error);
    return NextResponse.json(
      { error: 'Failed to fetch block data' },
      { status: 500 }
    );
  }
}
