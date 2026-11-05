import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/app/api/lib/rate-limit';

/**
 * Apply a per-client bucket to a Refinery proxy route.
 * Returns a 429 response when the caller is over the limit.
 */
export function rateLimitResponse(
  request: NextRequest,
  maxRequests: number,
  bucket: string,
): NextResponse | null {
  const result = checkRateLimit(`${getClientIdentifier(request)}:${bucket}`, maxRequests);
  if (result.success) return null;

  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: {
        ...getRateLimitHeaders(result),
        'Cache-Control': 'no-store',
      },
    },
  );
}
