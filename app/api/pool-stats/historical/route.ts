import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { parseHashrate } from '../../../utils/formatters';

// Enable caching based on interval
export const revalidate = 60; // Default to 1 minute

export interface HistoricalPoolStats {
  timestamp: number;
  users: number;
  workers: number;
  idle: number;
  disconnected: number;
  hashrate15m: number;
  hashrate1d: number;
}

interface RawStatsRow {
  timestamp: number;
  users: number;
  workers: number;
  idle: number;
  disconnected: number;
  hashrate15m: string;
  hashrate1d: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse parameters with defaults
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
    
    // Get the data from the database
    const db = getDb();
    
    // Parse the interval
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
        // Default to 5 minutes
        intervalSeconds = 5 * 60;
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
    const results: HistoricalPoolStats[] = [];
    
    for (const { start, end } of intervals) {
      const rows = db.prepare(`
        SELECT 
          AVG(users) as users, 
          AVG(workers) as workers, 
          AVG(idle) as idle, 
          AVG(disconnected) as disconnected,
          hashrate15m,
          hashrate1d,
          timestamp
        FROM pool_stats 
        WHERE timestamp >= ? AND timestamp < ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).all(start, end) as RawStatsRow[];
      
      if (rows.length > 0) {
        const row = rows[0];
        // Only include intervals that have real data (non-zero values)
        if (row.users > 0 || row.workers > 0 || parseHashrate(row.hashrate15m) > 0 || parseHashrate(row.hashrate1d) > 0) {
          results.push({
            timestamp: start,
            users: Math.round(row.users),
            workers: Math.round(row.workers),
            idle: Math.round(row.idle),
            disconnected: Math.round(row.disconnected),
            hashrate15m: parseHashrate(row.hashrate15m),
            hashrate1d: parseHashrate(row.hashrate1d)
          });
        }
      }
    }
    
    // Return response with cache headers
    return new NextResponse(JSON.stringify(results), {
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
