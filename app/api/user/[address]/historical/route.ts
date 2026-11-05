import { NextResponse } from 'next/server';
import { parseHashrate } from '../../../../utils/hashmath';
import { getDb } from '../../../../../lib/db';
import { parseHistoricalParams } from '@/app/api/lib/historical';

// Enable caching based on interval
export const revalidate = 60;

export interface HistoricalUserStats {
  timestamp: string;
  hashrate: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const parsed = parseHistoricalParams(new URL(request.url).searchParams);
    if ('error' in parsed) return parsed.error;
    const { interval, intervalSeconds, cacheDuration, startTime, now } = parsed.range;

    // Determine which hashrate column to use based on interval
    let hashrateColumn: string;
    switch (interval) {
      case '1m':
        hashrateColumn = 'hashrate1m';
        break;
      case '5m':
        hashrateColumn = 'hashrate5m';
        break;
      case '1h':
        hashrateColumn = 'hashrate1hr';
        break;
      default:
        hashrateColumn = 'hashrate5m'; // Default to 5m (covers 15m/30m)
    }

    const db = getDb();

    // First get the user_id from monitored_users
    const user = db.prepare('SELECT id FROM monitored_users WHERE address = ? AND is_active = 1').get(address) as { id: number } | undefined;

    if (!user) {
      return NextResponse.json(
        { error: "User not found or not active" },
        { status: 404 }
      );
    }

    const rows = db.prepare(`
      WITH bucketed AS (
        SELECT
          ${hashrateColumn} AS hashrate,
          CAST((created_at - ?) / ? AS INTEGER) AS bucket,
          ROW_NUMBER() OVER (
            PARTITION BY CAST((created_at - ?) / ? AS INTEGER)
            ORDER BY created_at DESC
          ) AS row_number
        FROM user_stats_history
        WHERE user_id = ? AND created_at >= ? AND created_at < ?
      )
      SELECT hashrate, bucket
      FROM bucketed
      WHERE row_number = 1
      ORDER BY bucket ASC
    `).all(
      startTime,
      intervalSeconds,
      startTime,
      intervalSeconds,
      user.id,
      startTime,
      now,
    ) as { hashrate: string; bucket: number }[];

    const results = rows.flatMap(({ hashrate: rawHashrate, bucket }) => {
      const hashrate = parseHashrate(rawHashrate);
      if (!(hashrate > 0)) return [];

      return [{
        timestamp: new Date((startTime + bucket * intervalSeconds) * 1000).toISOString(),
        hashrate,
      }];
    });

    return new NextResponse(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
      }
    });

  } catch (error) {
    console.error("Error fetching historical user stats:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch historical user stats" }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
