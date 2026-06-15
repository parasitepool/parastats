import { NextRequest, NextResponse } from 'next/server';
import type { OrderSummary } from '../types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 200 });
  }

  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 400 });
  }

  try {
    const url = new URL(`${routerBase}/api/router/orders`);
    url.searchParams.set('address', address);

    const headers: Record<string, string> = {};
    if (process.env.ROUTER_API_TOKEN) {
      headers.Authorization = `Bearer ${process.env.ROUTER_API_TOKEN}`;
    }

    const res = await fetch(url, { cache: 'no-store', headers });
    if (!res.ok) {
      return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 200 });
    }

    const orders: unknown = await res.json();
    const hasRefineryOperatorBadge = Array.isArray(orders)
      && orders.some((order: Partial<OrderSummary>) => order.status === 'fulfilled');

    return NextResponse.json({ hasRefineryOperatorBadge }, { status: 200 });
  } catch {
    return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 200 });
  }
}
