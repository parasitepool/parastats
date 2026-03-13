import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getClaimedAddresses } from '@/lib/dispenser-cache';
import { queryRoundParticipants } from '../types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'difficulty';
    const limit = parseInt(searchParams.get('limit') || '99', 10);

    const db = getDb();
    const claimedSet = getClaimedAddresses();
    const result = queryRoundParticipants(db, 0, type, limit, claimedSet);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching current round:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current round data' },
      { status: 500 }
    );
  }
}
