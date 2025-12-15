import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';

interface BlockWinner {
  block_height: number;
  winner_address: string;
  difficulty: number;
  block_timestamp: number | null;
}

interface UserBlockDiff {
  address: string;
  difficulty: number;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ blockheight: string }> }
) {
  try {
    const { blockheight } = await params;
    const blockHeight = parseInt(blockheight, 10);

    if (isNaN(blockHeight)) {
      return NextResponse.json(
        { error: 'Invalid block height' },
        { status: 400 }
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
    `).get(blockHeight) as BlockWinner | undefined;

    if (!winner) {
      return NextResponse.json(
        { error: 'No data found for this block' },
        { status: 404 }
      );
    }

    // Get all user diffs for this block
    const userDiffs = db.prepare(`
      SELECT 
        address,
        difficulty
      FROM user_block_diff
      WHERE block_height = ?
      ORDER BY difficulty DESC
    `).all(blockHeight) as UserBlockDiff[];

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
    });

  } catch (error) {
    console.error('Error fetching block highest diff:', error);
    return NextResponse.json(
      { error: 'Failed to fetch block data' },
      { status: 500 }
    );
  }
}


