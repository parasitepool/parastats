import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export interface StratumNotification {
  id: string;
  timestamp: number;
  pool: string;
  jobId: string;
  prevBlockHash: string;
  coinbase1: string;
  coinbase2: string;
  merkleBranches: string[];
  version: string;
  nBits: string;
  nTime: string;
  cleanJobs: boolean;
  extranonce1?: string;
  extranonce2Size?: number;
  raw: Record<string, unknown>;
}

interface StratumNotificationRow {
  id: number;
  notification_id: string;
  timestamp: number;
  pool: string;
  job_id: string;
  prev_block_hash: string;
  coinbase1: string;
  coinbase2: string;
  merkle_branches: string;
  version: string;
  n_bits: string;
  n_time: string;
  clean_jobs: number;
  extranonce1: string | null;
  extranonce2_size: number | null;
  raw_message: string;
}

export async function GET() {
  try {
    const db = getDb();
    
    // Get the most recent notification (or latest 10)
    const rows = db.prepare(`
      SELECT * FROM stratum_notifications 
      WHERE pool = 'Parasite' 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all() as StratumNotificationRow[];
    
    if (rows.length === 0) {
      // Return empty array if no real data available
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }
    
    const notifications: StratumNotification[] = rows.map(row => ({
      id: row.notification_id,
      timestamp: row.timestamp,
      pool: row.pool,
      jobId: row.job_id,
      prevBlockHash: row.prev_block_hash,
      coinbase1: row.coinbase1,
      coinbase2: row.coinbase2,
      merkleBranches: JSON.parse(row.merkle_branches),
      version: row.version,
      nBits: row.n_bits,
      nTime: row.n_time,
      cleanJobs: Boolean(row.clean_jobs),
      extranonce1: row.extranonce1 || undefined,
      extranonce2Size: row.extranonce2_size || undefined,
      raw: JSON.parse(row.raw_message) as Record<string, unknown>
    }));
    
    return NextResponse.json(notifications, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Error fetching stratum data:", error);
    return NextResponse.json({ error: "Failed to fetch stratum data" }, { status: 500 });
  }
}
