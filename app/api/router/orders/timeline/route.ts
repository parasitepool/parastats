import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';
import { cachedJson } from '@/lib/route-cache';
import { fetchAllRouterOrders, routerAuthHeaders } from '@/lib/router-orders';
import type { OrderDetail, OrderTimelinePoint } from '../../types';

export const dynamic = 'force-dynamic';

// Assembling the timeline costs one or more orders-list pages plus detail
// fetches for new orders; cache so polling clients share one assembly per
// window.
const TTL_MS = 30_000;

// The orders list API does not return creation times, so each bucket order's
// detail must be fetched. Creation data is immutable once an order exists, so
// it is cached per order; only unknown orders are fetched. Entries for orders
// the router no longer reports are pruned so the cache can't grow forever.
const orderCache = new Map<number, { created_at: number; requested_hash_days: number }>();

async function fetchTimeline(routerBase: string): Promise<OrderTimelinePoint[]> {
  // The list endpoint is paginated: fetch every active bucket order, not just
  // the newest page, so the demand chart accounts for the whole book.
  const orders = await fetchAllRouterOrders(routerBase, {
    status: 'active,in_mempool',
    kind: 'bucket',
  });

  // Bucket orders have a fixed work target; sink orders (no target) are excluded.
  const bucketOrders = orders.filter(
    o => o.requested_hash_days != null && o.requested_hash_days > 0,
  );

  // Prune cache entries for orders the router no longer reports.
  const currentIds = new Set(orders.map(o => o.id));
  for (const id of orderCache.keys()) {
    if (!currentIds.has(id)) orderCache.delete(id);
  }

  const missing = bucketOrders.filter(o => !orderCache.has(o.id));
  const details = await Promise.allSettled(
    missing.map(async order => {
      const res = await fetch(`${routerBase}/api/router/order/${order.id}`, {
        cache: 'no-store',
        headers: routerAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Order ${order.id} failed (${res.status})`);
      return (await res.json()) as OrderDetail;
    }),
  );

  details.forEach(result => {
    if (result.status === 'fulfilled') {
      orderCache.set(result.value.id, {
        created_at: result.value.created_at,
        requested_hash_days: result.value.requested_hash_days ?? 0,
      });
    } else {
      console.warn('Timeline: order detail fetch failed:', result.reason);
    }
  });

  return bucketOrders.flatMap(order => {
    const cached = orderCache.get(order.id);
    return cached
      ? [{
          id: order.id,
          status: order.status,
          ...cached,
          hashrate: order.hashrate,
          best_share: order.best_share,
        }]
      : [];
  });
}

export async function GET() {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const points = await cachedJson('router:orders:timeline', TTL_MS, () => fetchTimeline(routerBase));
    return NextResponse.json(points);
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
