import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';
import { cachedJson } from '@/lib/route-cache';

export const dynamic = 'force-dynamic';

// The whole site polls this; cache briefly so client count never multiplies
// into router load.
const TTL_MS = 10_000;

interface ProxiedResponse {
  status: number;
  body: unknown;
}

export async function GET() {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ error: 'Router not configured' }, { status: 503 });
  }

  try {
    const result = await cachedJson<ProxiedResponse>('router:status', TTL_MS, async () => {
      const headers: Record<string, string> = {};
      if (process.env.ROUTER_API_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.ROUTER_API_TOKEN}`;
      }
      const res = await fetch(`${routerBase}/api/router/status`, { headers });
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return { status: res.status, body: await res.json() };
      }
      if (contentType.includes('text/plain')) {
        return { status: res.status, body: { error: await res.text() } };
      }
      throw new Error('Router unavailable');
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
