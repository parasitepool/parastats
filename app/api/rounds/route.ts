import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { RoundRow } from './types';

export async function GET() {
  try {
    const db = getDb();

    const rounds = db.prepare(`
      SELECT block_height, block_hash, coinbase_value, winner_diff, winner_username, participant_status
      FROM rounds
      WHERE block_height != 0
      ORDER BY block_height DESC
    `).all() as RoundRow[];

    // Prepend synthetic current-round entry if participant data exists
    const currentRoundExists = db.prepare(
      `SELECT 1 FROM round_participants WHERE block_height = 0 LIMIT 1`
    ).get();

    if (currentRoundExists) {
      rounds.unshift({
        block_height: 0,
        block_hash: null,
        coinbase_value: null,
        winner_diff: null,
        winner_username: null,
        participant_status: 'complete',
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
