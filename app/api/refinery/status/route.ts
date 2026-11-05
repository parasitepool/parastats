import { NextRequest } from 'next/server';
import { cachedJson } from '@/lib/route-cache';
import {
  fetchRouterStatus,
  isSuccessfulResponse,
  routerErrorResponse,
  routerJsonResponse,
} from '@/lib/refinery-proxy';
import { rateLimitResponse } from '../rate-limit';

export const dynamic = 'force-dynamic';

// The whole site polls this; cache briefly so client count never multiplies
// into router load.
const TTL_MS = 10_000;

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) return routerErrorResponse('Router not configured', 503);

  const fresh = request.nextUrl.searchParams.get('fresh') === '1';
  const limited = rateLimitResponse(request, fresh ? 10 : 120, fresh ? 'status-fresh' : 'status');
  if (limited) return limited;

  try {
    const result = fresh
      ? await fetchRouterStatus(routerBase)
      : await cachedJson(
          'router:status',
          TTL_MS,
          () => fetchRouterStatus(routerBase),
          isSuccessfulResponse,
        );
    return routerJsonResponse(result);
  } catch {
    return routerErrorResponse('Router unavailable', 502);
  }
}
