import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import { getClaimedAddresses } from '@/lib/dispenser-cache';
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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), MAX_LIMIT);
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
    const claimedSet = getClaimedAddresses();

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
          claimed: claimedSet.has(u.address),
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
          claimed: claimedSet.has(d.address),
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
          claimed: claimedSet.has(b.top_diff_address),
          difficulty: b.difficulty,
          block_timestamp: b.block_timestamp,
        })),
        { headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const rows = db.prepare(`
      WITH recent AS (
        SELECT block_height, block_timestamp
        FROM block_highest_diff
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
    `).all(limit) as {
      block_height: number;
      block_timestamp: number | null;
      address: string | null;
      difficulty: number | null;
    }[];

    const results = rows.map(row => ({
      block_height: row.block_height,
      top_diff_address: row.address ? formatAddress(row.address) : null,
      claimed: row.address ? claimedSet.has(row.address) : false,
      difficulty: row.difficulty ?? null,
      block_timestamp: row.block_timestamp,
    }));

    return NextResponse.json(results, {
      headers: {
        ...getRateLimitHeaders(rateLimitResult),
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });

  } catch (error) {
    logError('highest-diff/route', error);
    return NextResponse.json(
      { error: 'Failed to fetch highest diff data' },
      { status: 500 }
    );
  }
}
