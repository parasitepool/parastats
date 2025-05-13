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

    // Validate interval is positive for numeric intervals
    const intervalMatch = interval.match(/^(-?\d+)([mh])$/);
    if (!intervalMatch || parseInt(intervalMatch[1], 10) <= 0) {
      return new NextResponse(
        JSON.stringify({ error: "Interval must be a positive value with unit (e.g., '5m', '1h')" }), 
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
      case '1d':
        hashrateColumn = 'hashrate1d';
        break;
      case '7d':
        hashrateColumn = 'hashrate7d';
        break;
      default:
        hashrateColumn = 'hashrate5m'; // Default to 5m
    }
    
    // Calculate the time range based on the period
    const now = Math.floor(Date.now() / 1000);
    let startTime = now;
    
    // Parse period format (e.g., "18d" or "6h")
    const periodMatch = period.match(/^(-?\d+)([dh])$/);
    
    if (periodMatch) {
      const value = parseInt(periodMatch[1], 10);
      if (value <= 0) {
        return new NextResponse(
          JSON.stringify({ error: "Period must be a positive value (e.g., '24h' or '7d')" }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
        );
      }

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
      startTime = now - value * multiplier;
    } else {
      // Default to 24 hours if format is invalid
      startTime = now - 24 * 60 * 60;
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