import { NextRequest } from 'next/server';
import { cachedJson } from '@/lib/route-cache';
import {
  fetchRouterResponse,
  forwardQueryParams,
  isSuccessfulResponse,
  routerErrorResponse,
  routerJsonResponse,
} from '@/lib/refinery-proxy';
import { rateLimitResponse } from '../../rate-limit';

export const dynamic = 'force-dynamic';

// Same caching rationale as the orders list: polling clients share one fetch.
const TTL_MS = 10_000;
const QUERY_PARAMS = ['address', 'status', 'review', 'search', 'kind'];

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) return routerErrorResponse('Router not configured', 503);

  const limited = rateLimitResponse(request, 120, 'orders-count');
  if (limited) return limited;

  const params = forwardQueryParams(request, QUERY_PARAMS);
  const url = new URL(`${routerBase}/api/router/orders/count`);
  for (const [param, value] of Object.entries(params)) {
    url.searchParams.set(param, value);
  }

  try {
    const result = await cachedJson(
      `router:orders:count:${JSON.stringify(params)}`,
      TTL_MS,
      () => fetchRouterResponse(url, { cache: 'no-store' }),
      isSuccessfulResponse,
    );
    return routerJsonResponse(result);
  } catch {
    return routerErrorResponse('Router unavailable', 502);
  }
}
