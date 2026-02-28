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
      // Only include users who are public (or not in monitored_users, which defaults to public)
      // Note: DB column is winner_address, aliased to top_diff_address for API consistency
      const topUsers = db.prepare(`
        SELECT 
          b.winner_address as address,
          COUNT(*) as watermark_count,
          SUM(b.difficulty) as total_diff,
          AVG(b.difficulty) as avg_diff
        FROM block_highest_diff b
        LEFT JOIN monitored_users m ON b.winner_address = m.address
        WHERE m.is_public = 1 OR m.address IS NULL
        GROUP BY b.winner_address
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
        { 
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
            // Cache leaderboard for 60s, allow stale for 5min while revalidating
            // This is an expensive query (full table scan + GROUP BY)
            'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
          }
        }
      );
    }

    if (address && type === 'user-diffs') {
      // Check if this user is public before returning their diffs
      const userPublicCheck = db.prepare(`
        SELECT is_public FROM monitored_users WHERE address = ?
      `).get(address) as { is_public: number } | undefined;
      
      // If user exists in monitored_users and is not public, return empty
      if (userPublicCheck && !userPublicCheck.is_public) {
        return NextResponse.json([], { headers: getRateLimitHeaders(rateLimitResult) });
      }

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
      // Check if this user is public before returning their watermarks
      const userPublicCheck = db.prepare(`
        SELECT is_public FROM monitored_users WHERE address = ?
      `).get(address) as { is_public: number } | undefined;
      
      // If user exists in monitored_users and is not public, return empty
      if (userPublicCheck && !userPublicCheck.is_public) {
        return NextResponse.json([], { headers: getRateLimitHeaders(rateLimitResult) });
      }

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
    // Show all blocks, but display the highest PUBLIC user's diff (not necessarily the original winner)
    // Step 1: Get recent blocks (fast, indexed query)
    const recentBlocks = db.prepare(`
      SELECT block_height, block_timestamp
      FROM block_highest_diff
      ORDER BY block_height DESC
      LIMIT ?
    `).all(limit) as { block_height: number; block_timestamp: number }[];

    // Step 2: For each block, get the top public user (small indexed queries)
    // This is O(limit) simple queries instead of one massive window function query
    const getTopPublicUser = db.prepare(`
      SELECT u.address, u.difficulty
      FROM user_block_diff u
      LEFT JOIN monitored_users m ON u.address = m.address
      WHERE u.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
      ORDER BY u.difficulty DESC
      LIMIT 1
    `);

    const results = recentBlocks.map(block => {
      const topUser = getTopPublicUser.get(block.block_height) as { address: string; difficulty: number } | undefined;
      return {
        block_height: block.block_height,
        top_diff_address: topUser ? formatAddress(topUser.address) : null,
        difficulty: topUser?.difficulty ?? null,
        block_timestamp: block.block_timestamp,
      };
    });

    return NextResponse.json(results, { headers: getRateLimitHeaders(rateLimitResult) });

  } catch (error) {
    logError('highest-diff/route', error);
    return NextResponse.json(
      { error: 'Failed to fetch highest diff data' },
      { status: 500 }
    );
  }
}
