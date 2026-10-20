import { NextRequest, NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';
import { cachedJson } from '@/lib/route-cache';

export const dynamic = 'force-dynamic';

// The refinery page polls this per client; cache briefly so client count
// never multiplies into router load.
const TTL_MS = 10_000;

interface ProxiedResponse {
  status: number;
  body: unknown;
}

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json([], { status: 200 });
  }

  const params: Record<string, string> = {};
  for (const param of ['address', 'status', 'review', 'search', 'limit']) {
    const value = request.nextUrl.searchParams.get(param);
    if (value) params[param] = value;
  }

  try {
    const result = await cachedJson<ProxiedResponse>(
      `router:orders:${JSON.stringify(params)}`,
      TTL_MS,
      async () => {
        const url = new URL(`${routerBase}/api/router/orders`);
        for (const [param, value] of Object.entries(params)) {
          url.searchParams.set(param, value);
        }
        const headers: Record<string, string> = {};
        if (process.env.ROUTER_API_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.ROUTER_API_TOKEN}`;
        }
        const res = await fetch(url, { cache: 'no-store', headers });
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          return { status: res.status, body: await res.json() };
        }
        if (contentType.includes('text/plain')) {
          return { status: res.status, body: { error: await res.text() } };
        }
        throw new Error('Router unavailable');
      },
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
