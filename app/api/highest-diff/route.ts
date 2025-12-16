import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  MAX_LIMIT,
  BlockHighestDiffRow,
  UserDiffCountRow,
  UserDiffWithTimestampRow,
  logError,
} from './types';

/**
 * PRIVACY: This API only returns truncated addresses.
 * Full addresses are never exposed to protect user privacy.
 */
export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10', 10)), MAX_LIMIT);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || 'recent'; // recent, leaderboard, user-diffs

    // Validate address if provided
    if (address && !isValidBitcoinAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address format' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const db = getDb();

    if (type === 'leaderboard') {
      // Get leaderboard of users by watermark count (how many times they had the top diff)
      // Note: DB column is winner_address, aliased to top_diff_address for API consistency
      const topUsers = db.prepare(`
        SELECT 
          winner_address as address,
          COUNT(*) as watermark_count,
          SUM(difficulty) as total_diff,
          AVG(difficulty) as avg_diff
        FROM block_highest_diff
        GROUP BY winner_address
        ORDER BY watermark_count DESC
        LIMIT ?
      `).all(limit) as UserDiffCountRow[];

      return NextResponse.json(
        topUsers.map(u => ({
          address: formatAddress(u.address), // Truncated only
          watermark_count: u.watermark_count,
          total_diff: u.total_diff,
          avg_diff: u.avg_diff,
        })),
        { headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    if (address && type === 'user-diffs') {
      // Get this user's best diffs across all blocks (not just watermarks)
      // Join with block_highest_diff to get the block timestamp
      const userDiffs = db.prepare(`
        SELECT 
          u.block_height,
          u.address,
          u.difficulty,
          b.block_timestamp
        FROM user_block_diff u
        LEFT JOIN block_highest_diff b ON u.block_height = b.block_height
        WHERE u.address = ?
        ORDER BY u.block_height DESC
        LIMIT ?
      `).all(address, limit) as UserDiffWithTimestampRow[];

      return NextResponse.json(
        userDiffs.map(d => ({
          block_height: d.block_height,
          difficulty: d.difficulty,
          block_timestamp: d.block_timestamp,
          address: formatAddress(d.address), // Truncated only
        })),
        { headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    if (address) {
      // Get blocks where this user had the top diff (watermarks only)
      // Note: DB column is winner_address, aliased for API consistency
      const userBlocks = db.prepare(`
        SELECT 
          block_height,
          winner_address as top_diff_address,
          difficulty,
          block_timestamp
        FROM block_highest_diff
        WHERE winner_address = ?
        ORDER BY block_height DESC
        LIMIT ?
      `).all(address, limit) as BlockHighestDiffRow[];

      return NextResponse.json(
        userBlocks.map(b => ({
          block_height: b.block_height,
          top_diff_address: formatAddress(b.top_diff_address), // Truncated only
          difficulty: b.difficulty,
          block_timestamp: b.block_timestamp,
        })),
        { headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    // Default: recent block watermarks (highest diffs per block)
    // Note: DB column is winner_address, aliased for API consistency
    const recentBlocks = db.prepare(`
      SELECT 
        block_height,
        winner_address as top_diff_address,
        difficulty,
        block_timestamp
      FROM block_highest_diff
      ORDER BY block_height DESC
      LIMIT ?
    `).all(limit) as BlockHighestDiffRow[];

    return NextResponse.json(
      recentBlocks.map(b => ({
        block_height: b.block_height,
        top_diff_address: formatAddress(b.top_diff_address), // Truncated only
        difficulty: b.difficulty,
        block_timestamp: b.block_timestamp,
      })),
      { headers: getRateLimitHeaders(rateLimitResult) }
    );

  } catch (error) {
    logError('highest-diff/route', error);
    return NextResponse.json(
      { error: 'Failed to fetch highest diff data' },
      { status: 500 }
    );
  }
}
