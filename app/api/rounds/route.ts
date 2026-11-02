import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computeCoinbaseOutputValue } from '@/app/utils/bitcoinUtils';
import type { RoundRow } from './types';

const MAX_TEMPLATE_AGE_SECONDS = 60;

function getCurrentTemplateReward(db: ReturnType<typeof getDb>): number | null {
  try {
    const row = db.prepare(`
      SELECT coinbase1, coinbase2, extranonce1, extranonce2_size, timestamp
      FROM stratum_notifications
      WHERE pool = 'Parasite'
      ORDER BY id DESC
      LIMIT 1
    `).get() as {
      coinbase1: string;
      coinbase2: string;
      extranonce1: string | null;
      extranonce2_size: number | null;
      timestamp: number;
    } | undefined;

    if (!row) return null;

    const ageSeconds = Math.floor(Date.now() / 1000) - row.timestamp;
    if (ageSeconds > MAX_TEMPLATE_AGE_SECONDS) return null;

    const extranonce1 = row.extranonce1 || '00000000';
    const extranonce2Size = row.extranonce2_size ?? 4;
    const coinbaseRaw =
      row.coinbase1 + extranonce1 + '00'.repeat(extranonce2Size) + row.coinbase2;
    const value = computeCoinbaseOutputValue(coinbaseRaw);

    return value > 0 ? value : null;
  } catch (error) {
    console.error('Error computing current template reward:', error);
    return null;
  }
}

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

    // PRIVACY: redact winners who opted out of public listing (unmonitored
    // winners stay visible, matching the participant queries). Public
    // winners' full addresses are returned since they're on-chain anyway.
    const rounds: RoundRow[] = rows.map(({ winner_is_public, winner_username, ...row }) => ({
      ...row,
      winner_username:
        winner_username && (winner_is_public === null || winner_is_public === 1)
          ? winner_username
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
        coinbase_value: getCurrentTemplateReward(db),
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
