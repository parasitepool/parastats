import { NextResponse } from 'next/server';
import { parseHashrate } from '../../../../utils/formatters';
import { getDb } from '../../../../../lib/db';

// Enable caching based on interval
export const revalidate = 60;

const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h']);

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
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    const interval = searchParams.get('interval') || '5m';

    if (!ALLOWED_INTERVALS.has(interval)) {
      return new NextResponse(
        JSON.stringify({ error: "Interval must be one of: '1m', '5m', '15m', '30m', '1h'" }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    // Determine cache duration based on interval
    let cacheDuration = 300; // Default 5 minutes
    switch (interval) {
      case '1m':
        cacheDuration = 60; // 1 minute
        break;
      case '5m':
        cacheDuration = 300; // 5 minutes
        break;
      case '15m':
        cacheDuration = 900; // 15 minutes
        break;
      case '30m':
        cacheDuration = 1800; // 30 minutes
        break;
      case '1h':
        cacheDuration = 3600; // 1 hour
        break;
    }

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
    
    // Calculate the time range based on the period
    const now = Math.floor(Date.now() / 1000);
    
    // Parse period format (e.g., "18d" or "6h")
    const periodMatch = period.match(/^([1-9]\d*)([dh])$/);
    if (!periodMatch) {
      return new NextResponse(
        JSON.stringify({ error: "Period must be a positive value (e.g., '24h' or '7d')" }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    const value = parseInt(periodMatch[1], 10);
    const unit = periodMatch[2];

    // Calculate total days for max period check
    const totalDays = unit === 'd' ? value : value / 24;

    // Set max period based on the selected interval
    let maxPeriodDays = 30; // Default max

    // Apply interval-specific limits
    if (interval === '1m') {
      maxPeriodDays = 2; // 2 days max for 1-minute intervals
    } else if (interval === '5m') {
      maxPeriodDays = 10; // 10 days max for 5-minute intervals
    }

    if (totalDays > maxPeriodDays) {
      return new NextResponse(
        JSON.stringify({
          error: `For ${interval} interval, period cannot exceed ${maxPeriodDays} days`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    // Calculate seconds based on unit (d for days, h for hours)
    const multiplier = unit === 'd' ? 24 * 60 * 60 : 60 * 60;
    const startTime = now - value * multiplier;

    const db = getDb();

    // First get the user_id from monitored_users
    const user = db.prepare('SELECT id FROM monitored_users WHERE address = ? AND is_active = 1').get(address) as { id: number } | undefined;

    if (!user) {
      return NextResponse.json(
        { error: "User not found or not active" },
        { status: 404 }
      );
    }

    // Calculate interval seconds for aggregation
    let intervalSeconds;
    switch (interval) {
      case '1m':
        intervalSeconds = 60;
        break;
      case '5m':
        intervalSeconds = 5 * 60;
        break;
      case '15m':
        intervalSeconds = 15 * 60;
        break;
      case '30m':
        intervalSeconds = 30 * 60;
        break;
      case '1h':
        intervalSeconds = 60 * 60;
        break;
      default:
        intervalSeconds = 5 * 60; // Default to 5 minutes
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
      if (hashrate <= 0) return [];

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
