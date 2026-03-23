import { formatAddress } from '@/app/utils/formatters';
import type { getDb } from '@/lib/db';

export type ParticipantStatus = 'pending' | 'fetching' | 'complete' | 'error';

export interface RoundParticipantRow {
  username: string;
  top_diff: number;
  blocks_participated: number;
}

export interface RoundRow {
  block_height: number;
  block_hash: string | null;
  coinbase_value: number | null;
  winner_diff: number | null;
  winner_username: string | null;
  participant_status: ParticipantStatus;
  block_participant_status: ParticipantStatus;
}

/**
 * Query round participants and format them for API responses.
 * Shared by /api/rounds/current and /api/rounds/[blockHeight].
 */
export function queryRoundParticipants(
  db: ReturnType<typeof getDb>,
  blockHeight: number,
  type: string,
  limit: number,
  claimedSet: Set<string>
) {
  const orderBy = type === 'participation'
    ? 'blocks_participated DESC'
    : 'top_diff DESC';

  const rows = db.prepare(`
    SELECT rp.username, rp.top_diff, rp.blocks_participated
    FROM round_participants rp
    LEFT JOIN monitored_users m ON rp.username = m.address
    WHERE rp.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(blockHeight, limit) as RoundParticipantRow[];

  return rows.map((row, index) => ({
    rank: index + 1,
    address: formatAddress(row.username),
    claimed: claimedSet.has(row.username),
    top_diff: row.top_diff,
    blocks_participated: row.blocks_participated,
  }));
}
