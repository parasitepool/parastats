import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import { formatAddress } from '@/app/utils/formatters';
import type { OrderStatus, OrderSummary, PublicOrderSummary } from '../types';

export const dynamic = 'force-dynamic';

const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'in_mempool',
  'active',
  'fulfilled',
  'cancelled',
  'disconnected',
  'expired',
];

const CURRENT_STATUSES: OrderStatus[] = ['active', 'pending', 'in_mempool'];

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function toPublicOrder(order: OrderSummary): PublicOrderSummary {
  return {
    id: order.id,
    status: order.status,
    address: formatAddress(order.username.split('.')[0]),
    requested_hash_days: order.requested_hash_days,
    hashrate: order.hashrate,
    delivered_hash_days: order.delivered_hash_days,
    best_share: order.best_share,
  };
}

function buildPublicOrders(
  orders: OrderSummary[],
  statuses: OrderStatus[] | null,
  limit: number
): PublicOrderSummary[] {
  if (statuses) {
    const wanted = new Set(statuses);
    return orders
      .filter(o => wanted.has(o.status))
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map(toPublicOrder);
  }

  // Default view: all current orders plus the most recent terminal ones
  const currentSet = new Set(CURRENT_STATUSES);
  const current = orders
    .filter(o => currentSet.has(o.status))
    .sort((a, b) => b.id - a.id);
  const terminal = orders
    .filter(o => !currentSet.has(o.status))
    .sort((a, b) => b.id - a.id)
    .slice(0, Math.max(0, limit - current.length));
  return [...current, ...terminal].map(toPublicOrder);
}

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json([], { status: 200 });
  }

  const address = request.nextUrl.searchParams.get('address');

  // Public pool-wide view: rate-limited, validated params
  let statuses: OrderStatus[] | null = null;
  let limit = DEFAULT_LIMIT;
  if (!address) {
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    if (statusParam) {
      const parsed = statusParam.split(',').map(s => s.trim());
      const invalid = parsed.filter(s => !ALL_STATUSES.includes(s as OrderStatus));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid status value(s): ${invalid.join(', ')}` },
          { status: 400 }
        );
      }
      statuses = parsed as OrderStatus[];
    }

    const limitParam = parseInt(request.nextUrl.searchParams.get('limit') || '', 10);
    if (!isNaN(limitParam)) {
      limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT);
    }
  }

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
      if (address || !res.ok || !Array.isArray(data)) {
        return NextResponse.json(data, { status: res.status });
      }
      return NextResponse.json(buildPublicOrders(data, statuses, limit), {
        status: 200,
        headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
      });
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
