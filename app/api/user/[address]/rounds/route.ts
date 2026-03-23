import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export interface UserRoundHistoryEntry {
  block_height: number;
  rank: number;
  blocks_rank: number;
  total_participants: number;
  top_diff: number;
  blocks_participated: number;
  is_winner: boolean;
}

export interface UserRoundsResponse {
  current_round: {
    rank: number;
    blocks_rank: number;
    total_participants: number;
    top_diff: number;
    blocks_participated: number;
  } | null;
  rounds_won: number;
  total_rounds_participated: number;
  history: UserRoundHistoryEntry[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 20;

    const db = getDb();

    // Privacy check: return 403 if user is private
    const userPublicCheck = db.prepare(
      `SELECT is_public FROM monitored_users WHERE address = ?`
    ).get(address) as { is_public: number } | undefined;

    if (userPublicCheck && !userPublicCheck.is_public) {
      return NextResponse.json({ error: 'This user profile is private' }, { status: 403 });
    }

    // Current round (block_height = 0 sentinel)
    const currentUser = db.prepare(
      `SELECT top_diff, blocks_participated FROM round_participants WHERE block_height = 0 AND username = ?`
    ).get(address) as { top_diff: number; blocks_participated: number } | undefined;

    let current_round: UserRoundsResponse['current_round'] = null;

    if (currentUser) {
      const rankInfo = db.prepare(`
        SELECT
          COUNT(CASE WHEN top_diff > ? THEN 1 END) + 1 AS rank,
          COUNT(CASE WHEN blocks_participated > ? THEN 1 END) + 1 AS blocks_rank,
          COUNT(*) AS total
        FROM round_participants WHERE block_height = 0
      `).get(currentUser.top_diff, currentUser.blocks_participated) as { rank: number; blocks_rank: number; total: number };

      current_round = {
        rank: rankInfo.rank,
        blocks_rank: rankInfo.blocks_rank,
        total_participants: rankInfo.total,
        top_diff: currentUser.top_diff,
        blocks_participated: currentUser.blocks_participated,
      };
    }

    // Rounds won
    const wonRow = db.prepare(
      `SELECT COUNT(*) AS count FROM rounds WHERE winner_username = ?`
    ).get(address) as { count: number };

    // Total rounds participated (based on block participants)
    const participatedRow = db.prepare(
      `SELECT COUNT(*) AS count FROM block_participants WHERE username = ?`
    ).get(address) as { count: number };

    // History with rank, total participants, and winner status per round
    const history = db.prepare(`
      WITH user_blocks AS (
        SELECT block_height FROM block_participants WHERE username = ?
      ),
      ranked AS (
        SELECT
          rp.block_height,
          rp.username,
          rp.top_diff,
          rp.blocks_participated,
          RANK() OVER (PARTITION BY rp.block_height ORDER BY rp.top_diff DESC) AS rank,
          RANK() OVER (PARTITION BY rp.block_height ORDER BY rp.blocks_participated DESC) AS blocks_rank,
          COUNT(*) OVER (PARTITION BY rp.block_height) AS total_participants
        FROM round_participants rp
        INNER JOIN user_blocks ub ON ub.block_height = rp.block_height
        WHERE rp.block_height > 0
      )
      SELECT
        ranked.block_height,
        ranked.top_diff,
        ranked.blocks_participated,
        ranked.rank,
        ranked.blocks_rank,
        ranked.total_participants,
        CASE WHEN r.winner_username = ? THEN 1 ELSE 0 END AS is_winner
      FROM ranked
      LEFT JOIN rounds r ON r.block_height = ranked.block_height
      WHERE ranked.username = ?
      ORDER BY ranked.block_height DESC
      LIMIT ?
    `).all(address, address, address, limit) as {
      block_height: number;
      top_diff: number;
      blocks_participated: number;
      rank: number;
      blocks_rank: number;
      total_participants: number;
      is_winner: number;
    }[];

    const response: UserRoundsResponse = {
      current_round,
      rounds_won: wonRow.count,
      total_rounds_participated: participatedRow.count,
      history: history.map(row => ({
        block_height: row.block_height,
        rank: row.rank,
        blocks_rank: row.blocks_rank,
        total_participants: row.total_participants,
        top_diff: row.top_diff,
        blocks_participated: row.blocks_participated,
        is_winner: row.is_winner === 1,
      })),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error fetching user rounds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user rounds' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
