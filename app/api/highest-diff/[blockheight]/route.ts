import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  MAX_BLOCK_HEIGHT,
  MAX_USERS_PER_BLOCK,
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

    // Get the block data first to check if it exists
    const blockData = db.prepare(`
      SELECT 
        block_height,
        block_timestamp
      FROM block_highest_diff
      WHERE block_height = ?
    `).get(blockHeight) as { block_height: number; block_timestamp: number } | undefined;

    if (!blockData) {
      return NextResponse.json(
        { error: 'No data found for this block' },
        { status: 404, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    // Get all user diffs for this block, filtered to only include public users
    // Users not in monitored_users are treated as public by default
    const userDiffs = db.prepare(`
      SELECT 
        u.address,
        u.difficulty
      FROM user_block_diff u
      LEFT JOIN monitored_users m ON u.address = m.address
      WHERE u.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
      ORDER BY u.difficulty DESC
      LIMIT ?
    `).all(blockHeight, MAX_USERS_PER_BLOCK) as UserBlockDiffRow[];

    // The top diff is now the highest public user, not necessarily the original winner
    const topPublicUser = userDiffs.length > 0 ? userDiffs[0] : null;

    // Return only truncated addresses - never expose full addresses
    return NextResponse.json({
      block_height: blockData.block_height,
      block_timestamp: blockData.block_timestamp,
      top_diff: topPublicUser ? {
        address: formatAddress(topPublicUser.address), // Truncated only
        difficulty: topPublicUser.difficulty,
      } : null,
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
