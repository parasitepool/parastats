import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  MAX_LIMIT,
  BlockWinnerRow,
  UserWinCountRow,
  UserDiffWithTimestampRow,
  logError,
} from './types';

/**
 * PRIVACY: This API only returns truncated addresses.
 * Full addresses are never exposed to protect user privacy.
 */
export async function GET(request: Request) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimitResult = checkRateLimit(clientId);
  
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
    const type = searchParams.get('type') || 'recent'; // recent, winners, user-diffs

    // Validate address if provided
    if (address && !isValidBitcoinAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address format' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const db = getDb();

    if (type === 'winners') {
      // Get leaderboard of users by win count
      const winners = db.prepare(`
        SELECT 
          winner_address as address,
          COUNT(*) as win_count,
          SUM(difficulty) as total_diff,
          AVG(difficulty) as avg_diff
        FROM block_highest_diff
        GROUP BY winner_address
        ORDER BY win_count DESC
        LIMIT ?
      `).all(limit) as UserWinCountRow[];

      return NextResponse.json(
        winners.map(w => ({
          address: formatAddress(w.address), // Truncated only
          win_count: w.win_count,
          total_diff: w.total_diff,
          avg_diff: w.avg_diff,
        })),
        { headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    if (address && type === 'user-diffs') {
      // Get this user's best diffs across all blocks (not just wins)
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
      // Get blocks where this user had the highest diff (wins only)
      const userBlocks = db.prepare(`
        SELECT 
          block_height,
          winner_address,
          difficulty,
          block_timestamp
        FROM block_highest_diff
        WHERE winner_address = ?
        ORDER BY block_height DESC
        LIMIT ?
      `).all(address, limit) as BlockWinnerRow[];

      return NextResponse.json(
        userBlocks.map(b => ({
          block_height: b.block_height,
          winner_address: formatAddress(b.winner_address), // Truncated only
          difficulty: b.difficulty,
          block_timestamp: b.block_timestamp,
        })),
        { headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    // Default: recent block winners
    const recentBlocks = db.prepare(`
      SELECT 
        block_height,
        winner_address,
        difficulty,
        block_timestamp
      FROM block_highest_diff
      ORDER BY block_height DESC
      LIMIT ?
    `).all(limit) as BlockWinnerRow[];

    return NextResponse.json(
      recentBlocks.map(b => ({
        block_height: b.block_height,
        winner_address: formatAddress(b.winner_address), // Truncated only
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
