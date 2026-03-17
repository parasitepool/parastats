import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getClaimedAddresses } from '@/lib/dispenser-cache';
import type { RoundRow } from '../types';
import { queryRoundParticipants } from '../types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blockHeight: string }> }
) {
  try {
    const { blockHeight: blockHeightStr } = await params;
    const blockHeight = parseInt(blockHeightStr, 10);

    if (isNaN(blockHeight)) {
      return NextResponse.json({ error: 'Invalid block height' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'difficulty';
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 999)
      : 99;

    const db = getDb();
    const claimedSet = getClaimedAddresses();

    // Block 0 is the current round — serve directly without status check
    if (blockHeight !== 0) {
      // Check if this round exists and its participant status
      const round = db.prepare(
        'SELECT participant_status FROM rounds WHERE block_height = ?'
      ).get(blockHeight) as RoundRow | undefined;

      if (!round) {
        return NextResponse.json({ error: 'Round not found' }, { status: 404 });
      }

      if (round.participant_status !== 'complete') {
        return NextResponse.json(
          { participant_status: round.participant_status },
          { status: 202 }
        );
      }
    }

    const result = queryRoundParticipants(db, blockHeight, type, limit, claimedSet);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching round data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch round data' },
      { status: 500 }
    );
  }
}
