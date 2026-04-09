import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ error: 'Router not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const res = await fetch(`${routerBase}/api/router/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
