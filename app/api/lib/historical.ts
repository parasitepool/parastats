import { NextResponse } from 'next/server';

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
};

const CACHE_DURATION_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 300,
  '1h': 3600,
};

export interface HistoricalRange {
  period: string;
  interval: string;
  intervalSeconds: number;
  cacheDuration: number;
  startTime: number;
  now: number;
}

function badRequest(message: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Parse and validate the shared `period`/`interval` query parameters used by
 * the historical stats endpoints. Returns either a ready-to-send 400 response
 * or the validated time range and bucketing parameters.
 */
export function parseHistoricalParams(
  searchParams: URLSearchParams
): { error: NextResponse } | { range: HistoricalRange } {
  const interval = searchParams.get('interval') || '5m';

  if (!Object.hasOwn(INTERVAL_SECONDS, interval)) {
    return { error: badRequest("Interval must be one of: '1m', '5m', '15m', '30m', '1h'") };
  }

  const intervalSeconds = INTERVAL_SECONDS[interval];

  const period = searchParams.get('period') || '24h';
  const periodMatch = period.match(/^([1-9]\d*)([dh])$/);
  if (!periodMatch) {
    return { error: badRequest("Period must be a positive value (e.g., '24h' or '7d')") };
  }

  const value = parseInt(periodMatch[1], 10);
  const unit = periodMatch[2];
  const totalDays = unit === 'd' ? value : value / 24;

  // Finer intervals are capped harder to bound the rows scanned per request
  const maxPeriodDays = interval === '1m' ? 2 : interval === '5m' ? 10 : 30;
  if (totalDays > maxPeriodDays) {
    return { error: badRequest(`For ${interval} interval, period cannot exceed ${maxPeriodDays} days`) };
  }

  const now = Math.floor(Date.now() / 1000);
  const multiplier = unit === 'd' ? 24 * 60 * 60 : 60 * 60;

  return {
    range: {
      period,
      interval,
      intervalSeconds,
      cacheDuration: CACHE_DURATION_SECONDS[interval],
      startTime: now - value * multiplier,
      now,
    },
  };
}
