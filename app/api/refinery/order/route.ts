import { NextRequest } from 'next/server';
import {
  fetchRouterResponse,
  fetchRouterStatus,
  isSuccessfulResponse,
  routerErrorResponse,
  routerJsonResponse,
} from '@/lib/refinery-proxy';
import type { RouterStatus } from '../types';
import { rateLimitResponse } from '../rate-limit';

export async function POST(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) return routerErrorResponse('Router not configured', 503);

  const limited = rateLimitResponse(request, 5, 'order-create');
  if (limited) return limited;

  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return routerErrorResponse('Invalid order request', 400);
    }

    const status = await fetchRouterStatus(routerBase, { timeout: 10_000 });
    if (!isSuccessfulResponse(status)) return routerJsonResponse(status);

    const quote = status.body as RouterStatus;
    if (!Number.isSafeInteger(quote?.hash_price) || quote.hash_price <= 0 ||
        typeof quote.halt !== 'boolean' || typeof quote.wallet?.synced !== 'boolean') {
      return routerErrorResponse('Router returned an invalid quote', 502);
    }
    if (quote.halt || !quote.wallet.synced) {
      return routerErrorResponse('Order creation is temporarily unavailable', 503);
    }

    try {
      const result = await fetchRouterResponse(`${routerBase}/api/router/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, hash_price: quote.hash_price }),
        signal: AbortSignal.timeout(30_000),
      });
      return routerJsonResponse(result);
    } catch {
      return routerErrorResponse('Order outcome unknown. Check your orders before retrying; the order may have been created.', 504);
    }
  } catch {
    return routerErrorResponse('Router unavailable', 502);
  }
}
