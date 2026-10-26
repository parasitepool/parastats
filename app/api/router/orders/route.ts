import { NextRequest, NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';
import { cachedJson } from '@/lib/route-cache';
import { fetchAllRouterOrders, routerAuthHeaders } from '@/lib/router-orders';

export const dynamic = 'force-dynamic';

// The refinery page polls this per client; cache briefly so client count
// never multiplies into router load.
const TTL_MS = 10_000;

const PAGE_HEADERS = ['x-limit', 'x-next-cursor'];

interface ProxiedResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json([], { status: 200 });
  }

  const params: Record<string, string> = {};
  for (const param of ['address', 'status', 'review', 'search', 'kind', 'limit', 'cursor']) {
    const value = request.nextUrl.searchParams.get(param);
    if (value) params[param] = value;
  }

  // The frontend asks for complete lists, but keep pass-through paging for
  // callers that explicitly request a page.
  const isPageRequest = Boolean(params.limit || params.cursor);

  try {
    if (!isPageRequest) {
      const orders = await cachedJson<unknown>(
        `router:orders:${JSON.stringify(params)}`,
        TTL_MS,
        () => fetchAllRouterOrders(routerBase, params),
      );
      return NextResponse.json(orders);
    }

    const result = await cachedJson<ProxiedResponse>(
      `router:orders:${JSON.stringify(params)}`,
      TTL_MS,
      async () => {
        const url = new URL(`${routerBase}/api/router/orders`);
        for (const [param, value] of Object.entries(params)) {
          url.searchParams.set(param, value);
        }
        const res = await fetch(url, {
          cache: 'no-store',
          headers: routerAuthHeaders(),
        });

        const pageHeaders: Record<string, string> = {};
        for (const name of PAGE_HEADERS) {
          const value = res.headers.get(name);
          if (value) pageHeaders[name] = value;
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          return { status: res.status, body: await res.json(), headers: pageHeaders };
        }
        if (contentType.includes('text/plain')) {
          return { status: res.status, body: { error: await res.text() }, headers: pageHeaders };
        }
        throw new Error('Router unavailable');
      },
    );

    const response = NextResponse.json(result.body, { status: result.status });
    for (const [name, value] of Object.entries(result.headers ?? {})) {
      response.headers.set(name, value);
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
