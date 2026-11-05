import { NextRequest } from 'next/server';
import { cachedJson } from '@/lib/route-cache';
import { buildRouterOrdersUrl } from '@/lib/router-orders';
import {
  fetchRouterResponse,
  forwardQueryParams,
  isSuccessfulResponse,
  routerErrorResponse,
  routerJsonResponse,
} from '@/lib/refinery-proxy';
import { rateLimitResponse } from '../rate-limit';

export const dynamic = 'force-dynamic';

// The refinery page polls this per client; cache briefly so client count
// never multiplies into router load.
const TTL_MS = 10_000;
const PAGE_HEADERS = ['x-limit', 'x-next-cursor'];
const QUERY_PARAMS = ['address', 'status', 'review', 'search', 'kind', 'limit', 'cursor'];

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) return routerErrorResponse('Router not configured', 503);

  const limited = rateLimitResponse(request, 120, 'orders');
  if (limited) return limited;

  const params = forwardQueryParams(request, QUERY_PARAMS);

  try {
    const result = await cachedJson(
      `router:orders:${JSON.stringify(params)}`,
      TTL_MS,
      () => fetchRouterResponse(
        buildRouterOrdersUrl(routerBase, params),
        { cache: 'no-store' },
        PAGE_HEADERS,
      ),
      isSuccessfulResponse,
    );
    return routerJsonResponse(result);
  } catch {
    return routerErrorResponse('Router unavailable', 502);
  }
}
