import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';

interface BlockWinner {
  block_height: number;
  winner_address: string;
  difficulty: number;
  block_timestamp: number | null;
}

interface UserWinCount {
  address: string;
  win_count: number;
  total_diff: number;
  avg_diff: number;
}

const MAX_LIMIT = 500;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10', 10)), MAX_LIMIT);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || 'recent'; // recent, winners, user-diffs

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
      `).all(limit) as UserWinCount[];

      return NextResponse.json(
        winners.map(w => ({
          ...w,
          address: formatAddress(w.address),
          fullAddress: w.address,
        }))
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
      `).all(address, limit) as Array<{ block_height: number; address: string; difficulty: number; block_timestamp: number | null }>;

      return NextResponse.json(
        userDiffs.map(d => ({
          block_height: d.block_height,
          difficulty: d.difficulty,
          block_timestamp: d.block_timestamp,
          address: formatAddress(d.address),
          fullAddress: d.address,
        }))
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
      `).all(address, limit) as BlockWinner[];

      return NextResponse.json(
        userBlocks.map(b => ({
          ...b,
          winner_address: formatAddress(b.winner_address),
          fullAddress: b.winner_address,
        }))
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
    `).all(limit) as BlockWinner[];

    return NextResponse.json(
      recentBlocks.map(b => ({
        ...b,
        winner_address: formatAddress(b.winner_address),
        fullAddress: b.winner_address,
      }))
    );

  } catch (error) {
    console.error('Error fetching highest diff data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch highest diff data' },
      { status: 500 }
    );
  }
}

