import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { collectHighestDiff } from '@/lib/highest-diff-collector';

interface BlockWinner {
  block_height: number;
  winner_address: string;
  difficulty: number;
  collected_at: number;
}

interface UserWinCount {
  address: string;
  win_count: number;
  total_diff: number;
  avg_diff: number;
}

// Trigger collection for missing blocks
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const blockHeightsParam = searchParams.get('blocks');
    
    if (!blockHeightsParam) {
      return NextResponse.json({ error: 'Missing blocks parameter' }, { status: 400 });
    }

    const blockHeights = blockHeightsParam.split(',').map(h => parseInt(h, 10)).filter(h => !isNaN(h));
    
    if (blockHeights.length === 0) {
      return NextResponse.json({ error: 'No valid block heights provided' }, { status: 400 });
    }

    // Limit to 5 blocks at a time to prevent abuse
    const blocksToCollect = blockHeights.slice(0, 5);
    
    // Trigger collection in background (don't wait)
    const collectionPromises = blocksToCollect.map(height => 
      collectHighestDiff(height).catch(err => {
        console.error(`Error collecting block ${height}:`, err);
        return false;
      })
    );
    
    // Wait for all collections (with timeout)
    const results = await Promise.race([
      Promise.all(collectionPromises),
      new Promise<boolean[]>(resolve => setTimeout(() => resolve(blocksToCollect.map(() => false)), 5000))
    ]);

    return NextResponse.json({ 
      triggered: blocksToCollect, 
      results: results 
    });

  } catch (error) {
    console.error('Error triggering highest diff collection:', error);
    return NextResponse.json(
      { error: 'Failed to trigger collection' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || 'recent'; // recent, winners, user

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

    if (address) {
      // Get blocks where this user had the highest diff
      const userBlocks = db.prepare(`
        SELECT 
          block_height,
          winner_address,
          difficulty,
          collected_at
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
        collected_at
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

