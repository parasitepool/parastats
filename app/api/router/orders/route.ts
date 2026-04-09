import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json([], { status: 200 });
  }

  const address = request.nextUrl.searchParams.get('address');

  try {
    const url = new URL(`${routerBase}/api/router/orders`);
    if (address) url.searchParams.set('address', address);
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
