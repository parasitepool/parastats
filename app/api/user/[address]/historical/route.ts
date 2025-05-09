import { NextResponse } from 'next/server';
import { parseHashrate } from '../../../../utils/formatters';
import { getDb } from '../../../../../lib/db';

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
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    const interval = searchParams.get('interval') || '5m';

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
      case '1d':
        hashrateColumn = 'hashrate1d';
        break;
      case '7d':
        hashrateColumn = 'hashrate7d';
        break;
      default:
        hashrateColumn = 'hashrate5m'; // Default to 5m
    }
    
    // Calculate the start time based on the period
    const now = Math.floor(Date.now() / 1000);
    let startTime: number;
    switch (period) {
      case '1h':
        startTime = now - 60 * 60;
        break;
      case '6h':
        startTime = now - 6 * 60 * 60;
        break;
      case '24h':
      default:
        startTime = now - 24 * 60 * 60;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60;
        break;
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

    // If interval is 'raw', return all data points
    if (interval === 'raw') {
      const rows = db.prepare(`
        SELECT 
          created_at as timestamp,
          ${hashrateColumn} as hashrate
        FROM user_stats_history 
        WHERE user_id = ? AND created_at >= ?
        ORDER BY created_at ASC
      `).all(user.id, startTime) as { timestamp: number; hashrate: string }[];

      const result = rows.map(row => ({
        timestamp: new Date(row.timestamp * 1000).toISOString(),
        hashrate: parseHashrate(row.hashrate)
      }));

      return new NextResponse(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
        }
      });
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

    // Calculate intervals for the time range
    const intervals = [];
    for (let t = startTime; t < now; t += intervalSeconds) {
      intervals.push({
        start: t,
        end: t + intervalSeconds
      });
    }

    // Query for each interval and aggregate
    const results: HistoricalUserStats[] = [];

    for (const { start, end } of intervals) {
      const rows = db.prepare(`
        SELECT 
          ${hashrateColumn} as hashrate,
          created_at as timestamp
        FROM user_stats_history 
        WHERE user_id = ? AND created_at >= ? AND created_at < ?
        ORDER BY created_at DESC
        LIMIT 1
      `).all(user.id, start, end) as { timestamp: number; hashrate: string }[];

      if (rows.length > 0) {
        const row = rows[0];
        const hashrate = parseHashrate(row.hashrate);
        
        // Only include intervals that have real data
        if (hashrate > 0) {
          results.push({
            timestamp: new Date(start * 1000).toISOString(),
            hashrate: hashrate
          });
        }
      }
    }

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