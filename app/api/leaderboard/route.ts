import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import { getClaimedAddresses } from '@/lib/dispenser-cache';
import type { RoundParticipantRow } from '@/app/api/rounds/types';

interface BaseUser {
  id: number;
  address: string;
}

interface DifficultyUser extends BaseUser {
  diff: number;
}

interface LoyaltyUser extends BaseUser {
  total_blocks: number;
}

interface CombinedUser extends BaseUser {
  diff: number;
  total_blocks: number;
  diff_rank: number;
  loyalty_rank: number;
  combined_score: number;
}

/**
 * Format round participant rows into the leaderboard response shape.
 * Uses a synthetic id (row index) since round_participants has no auto-increment id.
 */
function formatRoundParticipants(
  rows: RoundParticipantRow[],
  claimedSet: Set<string>
) {
  return rows.map((row, index) => ({
    id: index + 1,
    address: formatAddress(row.username),
    claimed: claimedSet.has(row.username),
    diff: row.top_diff,
    total_blocks: row.blocks_participated,
  }));
}

function handleRoundQuery(
  db: ReturnType<typeof getDb>,
  type: string,
  blockHeight: number,
  limit: number,
  claimedSet: Set<string>
) {
  if (type === 'difficulty' || type === 'loyalty') {
    const isDiff = type === 'difficulty';
    const rows = db.prepare(`
      SELECT rp.username, rp.top_diff, rp.blocks_participated
      FROM round_participants rp
      LEFT JOIN monitored_users m ON rp.username = m.address
      WHERE rp.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
        AND ${isDiff ? 'rp.top_diff' : 'rp.blocks_participated'} > 0
      ORDER BY ${isDiff ? 'rp.top_diff' : 'rp.blocks_participated'} DESC
      LIMIT ?
    `).all(blockHeight, limit) as RoundParticipantRow[];
    return formatRoundParticipants(rows, claimedSet);
  }

  // combined (default)
  const rows = db.prepare(`
    WITH RankedParticipants AS (
      SELECT
        rp.username,
        rp.top_diff,
        rp.blocks_participated,
        RANK() OVER (ORDER BY rp.top_diff DESC) as diff_rank,
        RANK() OVER (ORDER BY rp.blocks_participated DESC) as loyalty_rank
      FROM round_participants rp
      LEFT JOIN monitored_users m ON rp.username = m.address
      WHERE rp.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
        AND (rp.top_diff > 0 OR rp.blocks_participated > 0)
    )
    SELECT
      username,
      top_diff,
      blocks_participated,
      diff_rank,
      loyalty_rank,
      (diff_rank + loyalty_rank) / 2.0 as combined_score
    FROM RankedParticipants
    ORDER BY combined_score ASC
    LIMIT ?
  `).all(blockHeight, limit) as (RoundParticipantRow & {
    diff_rank: number;
    loyalty_rank: number;
    combined_score: number;
  })[];

  return rows.map((row, index) => ({
    id: index + 1,
    address: formatAddress(row.username),
    claimed: claimedSet.has(row.username),
    diff: row.top_diff,
    total_blocks: row.blocks_participated,
    diff_rank: row.diff_rank,
    loyalty_rank: row.loyalty_rank,
    combined_score: row.combined_score,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'combined';
    const limit = parseInt(searchParams.get('limit') || '9', 10);
    const round = searchParams.get('round');

    const db = getDb();
    const claimedSet = getClaimedAddresses();

    // Round-scoped leaderboard queries
    if (round) {
      const blockHeight = round === 'current' ? 0 : parseInt(round, 10);
      if (round !== 'current' && isNaN(blockHeight)) {
        return NextResponse.json({ error: 'Invalid round parameter' }, { status: 400 });
      }
      const users = handleRoundQuery(db, type, blockHeight, limit, claimedSet);
      return NextResponse.json(users);
    }

    // All-time leaderboard (existing behavior)
    let users;

    switch (type) {
      case 'difficulty':
        users = db.prepare(`
          SELECT
            id,
            address,
            bestever as diff
          FROM monitored_users
          WHERE is_active = 1 AND is_public = 1 AND bestever > 0
          ORDER BY bestever DESC
          LIMIT ?
        `).all(limit).map((user: unknown) => ({
          ...(user as DifficultyUser),
          claimed: claimedSet.has((user as DifficultyUser).address),
          address: formatAddress((user as DifficultyUser).address),
        }));
        break;

      case 'loyalty':
        users = db.prepare(`
          SELECT
            id,
            address,
            total_blocks
          FROM monitored_users
          WHERE is_active = 1 AND is_public = 1 AND total_blocks > 0
          ORDER BY total_blocks DESC
          LIMIT ?
        `).all(limit).map((user: unknown) => ({
          ...(user as LoyaltyUser),
          claimed: claimedSet.has((user as LoyaltyUser).address),
          address: formatAddress((user as LoyaltyUser).address),
        }));
        break;

      case 'combined':
      default:
        users = db.prepare(`
          WITH RankedUsers AS (
            SELECT
              id,
              address,
              bestever,
              total_blocks,
              RANK() OVER (ORDER BY bestever DESC) as diff_rank,
              RANK() OVER (ORDER BY total_blocks DESC) as loyalty_rank
            FROM monitored_users
            WHERE is_active = 1 AND is_public = 1 AND max(total_blocks, bestever) > 0
          )
          SELECT
            id,
            address,
            bestever as diff,
            total_blocks,
            diff_rank,
            loyalty_rank,
            (diff_rank + loyalty_rank) / 2.0 as combined_score
          FROM RankedUsers
          ORDER BY combined_score ASC
          LIMIT ?
        `).all(limit).map((user: unknown) => ({
          ...(user as CombinedUser),
          claimed: claimedSet.has((user as CombinedUser).address),
          address: formatAddress((user as CombinedUser).address),
        }));
        break;
    }

    return NextResponse.json(users);

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}
