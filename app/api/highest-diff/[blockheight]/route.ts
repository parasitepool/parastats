import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import {
  MAX_BLOCK_HEIGHT,
  MAX_USERS_PER_BLOCK,
  BlockWinnerRow,
  UserBlockDiffRow,
  logError,
} from '../types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blockheight: string }> }
) {
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
    const { blockheight } = await params;
    const blockHeight = parseInt(blockheight, 10);

    // Validate block height with upper bound
    if (isNaN(blockHeight) || blockHeight < 0 || blockHeight > MAX_BLOCK_HEIGHT) {
      return NextResponse.json(
        { error: 'Invalid block height' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const db = getDb();

    // Get the pool winner for this block
    const winner = db.prepare(`
      SELECT 
        block_height,
        winner_address,
        difficulty,
        block_timestamp
      FROM block_highest_diff
      WHERE block_height = ?
    `).get(blockHeight) as BlockWinnerRow | undefined;

    if (!winner) {
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

    return NextResponse.json({
      block_height: winner.block_height,
      block_timestamp: winner.block_timestamp,
      winner: {
        address: formatAddress(winner.winner_address),
        fullAddress: winner.winner_address,
        difficulty: winner.difficulty,
      },
      users: userDiffs.map(u => ({
        address: formatAddress(u.address),
        fullAddress: u.address,
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
