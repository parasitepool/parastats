import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { RoundRow } from './types';

export async function GET() {
  try {
    const db = getDb();

    const rounds = db.prepare(`
      SELECT r.block_height, r.block_hash, r.coinbase_value, r.winner_diff, r.winner_username, r.participant_status,
             COALESCE(w.total_work, 0) AS total_work
      FROM rounds r
      LEFT JOIN (
        SELECT block_height, SUM(total_work) AS total_work
        FROM round_participants
        GROUP BY block_height
      ) w ON w.block_height = r.block_height
      WHERE r.block_height != 0
      ORDER BY r.block_height DESC
    `).all() as RoundRow[];

    // Prepend synthetic current-round entry if participant data exists
    const currentRound = db.prepare(
      `SELECT SUM(total_work) AS total_work FROM round_participants WHERE block_height = 0`
    ).get() as { total_work: number | null };

    if (currentRound.total_work !== null) {
      rounds.unshift({
        block_height: 0,
        block_hash: null,
        coinbase_value: null,
        winner_diff: null,
        winner_username: null,
        participant_status: 'complete',
        block_participant_status: 'complete',
        total_work: currentRound.total_work,
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
