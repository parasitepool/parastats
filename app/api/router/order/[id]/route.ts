import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ error: 'Router not configured' }, { status: 503 });
  }

  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  try {
    const res = await fetch(`${routerBase}/api/router/order/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
