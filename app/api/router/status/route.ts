import { NextResponse } from 'next/server';

export async function GET() {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ error: 'Router not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${routerBase}/api/router/status`);
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
