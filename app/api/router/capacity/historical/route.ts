import { NextResponse } from 'next/server';
import { getDb, ROUTER_CAPACITY_RETENTION_SECONDS } from '@/lib/db';
import type { CapacityPoint } from '../../types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Serves the locally collected used-capacity time series (last 3 days).
export async function GET() {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - ROUTER_CAPACITY_RETENTION_SECONDS;
    const rows = getDb()
      .prepare('SELECT timestamp, used_hash_days FROM router_capacity WHERE timestamp >= ? ORDER BY timestamp ASC')
      .all(cutoff) as CapacityPoint[];
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to read router capacity history:', error);
    return NextResponse.json({ error: 'Capacity history unavailable' }, { status: 500 });
  }
}
