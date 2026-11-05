import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { parseHashrate } from '../../../utils/hashmath';
import { parseHistoricalParams } from '@/app/api/lib/historical';

export const dynamic = 'force-dynamic';

function smoothAnomalies(data: HistoricalPoolStats[]): HistoricalPoolStats[] {
  if (data.length < 2) return data;
  
  const result = [...data];
  const DROP_THRESHOLD = 0.21;        // Must drop at least 21%
  const CORRELATION_THRESHOLD = 0.25; // Deltas must be within 25% of each other
  
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const curr = result[i];
    
    // Skip if previous values are zero (can't calculate percentage change)
    if (prev.hashrate1hr === 0 || prev.hashrate1d === 0 || prev.hashrate7d === 0) continue;
    
    // Calculate percentage changes
    const delta1hr = (curr.hashrate1hr - prev.hashrate1hr) / prev.hashrate1hr;
    const delta1d = (curr.hashrate1d - prev.hashrate1d) / prev.hashrate1d;
    const delta7d = (curr.hashrate7d - prev.hashrate7d) / prev.hashrate7d;
    
    // Check if all are dropping significantly
    if (delta1hr >= -DROP_THRESHOLD || delta1d >= -DROP_THRESHOLD || delta7d >= -DROP_THRESHOLD) {
      continue;
    }
    
    // Check if drops are correlated (similar magnitude)
    const avgDelta = (delta1hr + delta1d + delta7d) / 3;
    const isCorrelated = 
      Math.abs(delta1hr - avgDelta) < Math.abs(avgDelta) * CORRELATION_THRESHOLD &&
      Math.abs(delta1d - avgDelta) < Math.abs(avgDelta) * CORRELATION_THRESHOLD &&
      Math.abs(delta7d - avgDelta) < Math.abs(avgDelta) * CORRELATION_THRESHOLD;
    
    if (isCorrelated) {
      // Anomaly detected - replace with last known good value
      result[i] = {
        ...prev,
        timestamp: curr.timestamp,
        idle: curr.idle,
        disconnected: curr.disconnected,
      };
    }
  }
  
  return result;
}

export interface HistoricalPoolStats {
  timestamp: number;
  users: number;
  workers: number;
  idle: number;
  disconnected: number;
  hashrate15m: number;
  hashrate1hr: number;
  hashrate6hr: number;
  hashrate1d: number;
  hashrate7d: number;
}

export async function GET(request: Request) {
  try {
    const parsed = parseHistoricalParams(new URL(request.url).searchParams);
    if ('error' in parsed) return parsed.error;
    const { intervalSeconds, cacheDuration, startTime, now } = parsed.range;

    // Get the data from the database
    const db = getDb();

    const rows = db.prepare(`
      WITH bucketed AS (
        SELECT
          users,
          workers,
          idle,
          disconnected,
          hashrate15m,
          hashrate1hr,
          hashrate6hr,
          hashrate1d,
          hashrate7d,
          timestamp,
          ROW_NUMBER() OVER (
            PARTITION BY CAST((timestamp - ?) / ? AS INTEGER)
            ORDER BY timestamp DESC
          ) AS row_number
        FROM pool_stats
        WHERE timestamp >= ? AND timestamp < ?
      )
      SELECT
        users,
        workers,
        idle,
        disconnected,
        hashrate15m,
        hashrate1hr,
        hashrate6hr,
        hashrate1d,
        hashrate7d,
        timestamp
      FROM bucketed
      WHERE row_number = 1
      ORDER BY timestamp ASC
    `).all(startTime, intervalSeconds, startTime, now) as HistoricalPoolStats[];

    const results = rows.flatMap(row => {
      if (!(row.users > 0 || row.workers > 0 || parseHashrate(row.hashrate15m) > 0 || parseHashrate(row.hashrate1d) > 0)) {
        return [];
      }

      return [{
        timestamp: row.timestamp,
        users: row.users,
        workers: row.workers,
        idle: row.idle,
        disconnected: row.disconnected,
        hashrate15m: parseHashrate(row.hashrate15m),
        hashrate1hr: parseHashrate(row.hashrate1hr),
        hashrate6hr: parseHashrate(row.hashrate6hr),
        hashrate1d: parseHashrate(row.hashrate1d),
        hashrate7d: parseHashrate(row.hashrate7d),
      }];
    });
    
    // Apply anomaly smoothing to filter out measurement errors
    const smoothedResults = smoothAnomalies(results);
    
    // Return response with cache headers
    return new NextResponse(JSON.stringify(smoothedResults), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
      }
    });
  } catch (error) {
    console.error("Error fetching historical pool stats:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch historical pool stats" }), 
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
