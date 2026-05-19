import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json([], { status: 200 });
  }

  const address = request.nextUrl.searchParams.get('address');

  try {
    const url = new URL(`${routerBase}/api/router/orders`);
    if (address) url.searchParams.set('address', address);
    const headers: Record<string, string> = {};
    if (process.env.ROUTER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.ROUTER_API_TOKEN}`;
    }
    const res = await fetch(url, { cache: 'no-store', headers });
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
    if (contentType.includes('text/plain')) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
