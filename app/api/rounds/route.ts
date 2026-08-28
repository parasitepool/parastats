import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';
import type { RoundRow } from './types';

export async function GET() {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT r.block_height, r.block_hash, r.coinbase_value, r.winner_diff, r.winner_username, r.participant_status,
             r.network_difficulty,
             m.is_public AS winner_is_public,
             COALESCE(w.total_work, 0) AS total_work
      FROM rounds r
      LEFT JOIN monitored_users m ON m.address = r.winner_username
      LEFT JOIN (
        SELECT block_height, SUM(total_work) AS total_work
        FROM round_participants
        GROUP BY block_height
      ) w ON w.block_height = r.block_height
      WHERE r.block_height != 0
      ORDER BY r.block_height DESC
    `).all() as (RoundRow & { winner_is_public: number | null })[];

    // Best diff in the current round across all participants.
    const bestDiffRow = db.prepare(
      `SELECT MAX(top_diff) AS best_diff FROM round_participants WHERE block_height = 0`
    ).get() as { best_diff: number | null };

    // PRIVACY: only return truncated addresses, and redact winners who opted
    // out of public listing (unmonitored winners stay visible, matching the
    // participant queries).
    const rounds: RoundRow[] = rows.map(({ winner_is_public, winner_username, ...row }) => ({
      ...row,
      winner_username:
        winner_username && (winner_is_public === null || winner_is_public === 1)
          ? formatAddress(winner_username)
          : null,
    }));

    // Prepend synthetic current-round entry if participant data exists
    const currentRound = db.prepare(
      `SELECT SUM(total_work) AS total_work FROM round_participants WHERE block_height = 0`
    ).get() as { total_work: number | null };

    if (currentRound.total_work !== null) {
      rounds.unshift({
        block_height: 0,
        block_hash: null,
        coinbase_value: null,
        winner_diff: bestDiffRow.best_diff,
        winner_username: null,
        participant_status: 'complete',
        block_participant_status: 'complete',
        total_work: currentRound.total_work,
        network_difficulty: null,
      });
    }

    return NextResponse.json(rounds);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rounds data' },
      { status: 500 }
    );
  }
}
