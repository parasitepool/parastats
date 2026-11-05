import { NextRequest } from 'next/server';
import { scrubIpAddresses } from '@/lib/refinery-privacy';
import { fetchRouterResponse, routerErrorResponse, routerJsonResponse } from '@/lib/refinery-proxy';
import { rateLimitResponse } from '../../rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) return routerErrorResponse('Router not configured', 503);

  const limited = rateLimitResponse(request, 120, 'order-detail');
  if (limited) return limited;

  const { id } = await params;
  if (!/^\d+$/.test(id)) return routerErrorResponse('Invalid order ID', 400);

  try {
    const result = await fetchRouterResponse(`${routerBase}/api/router/order/${id}`);
    result.body = scrubIpAddresses(result.body);
    return routerJsonResponse(result);
  } catch {
    return routerErrorResponse('Router unavailable', 502);
  }
}
