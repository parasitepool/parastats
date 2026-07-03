import { NextRequest, NextResponse } from 'next/server';
import type { OrderSummary } from '../types';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare(
    'SELECT has_refinery_badge FROM monitored_users WHERE address = ?'
  ).get(address) as { has_refinery_badge: number } | undefined;

  if (user?.has_refinery_badge) {
    return NextResponse.json({ hasRefineryOperatorBadge: true }, { status: 200 });
  }

  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 200 });
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

    if (hasRefineryOperatorBadge && user) {
      db.prepare(
        'UPDATE monitored_users SET has_refinery_badge = 1 WHERE address = ?'
      ).run(address);
    }

    return NextResponse.json({ hasRefineryOperatorBadge }, { status: 200 });
  } catch {
    return NextResponse.json({ hasRefineryOperatorBadge: false }, { status: 200 });
  }
}
