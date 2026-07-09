import { getDb } from './db';
import type { OrderSummary } from '../app/api/router/types';

const BATCH_SIZE = parseInt(process.env.REFINERY_BADGE_BATCH_SIZE || '50');

export async function syncRefineryBadges() {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    console.log('⏭️  Refinery badge sync skipped (no ROUTER_API_URL)');
    return;
  }

  const db = getDb();
  const users = db.prepare(
    'SELECT address FROM monitored_users WHERE has_refinery_badge = 0'
  ).all() as { address: string }[];

  if (users.length === 0) {
    console.log('⏭️  Refinery badge sync skipped (no unlatched users)');
    return;
  }

  console.log(`🏭 Refinery badge sync starting for ${users.length} users`);

  const headers: Record<string, string> = {};
  if (process.env.ROUTER_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.ROUTER_API_TOKEN}`;
  }

  const latch = db.prepare(
    'UPDATE monitored_users SET has_refinery_badge = 1 WHERE address = ?'
  );

  let checked = 0;
  let latched = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async ({ address }) => {
        const url = new URL(`${routerBase}/api/router/orders`);
        url.searchParams.set('address', address);

        const res = await fetch(url, { cache: 'no-store', headers });
        if (!res.ok) return false;

        const orders: unknown = await res.json();
        return Array.isArray(orders)
          && orders.some((order: Partial<OrderSummary>) => order.status === 'fulfilled');
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        latch.run(batch[j].address);
        latched++;
      }
    }

    checked += batch.length;
    console.log(`🏭 Refinery badge sync: ${checked}/${users.length} checked, ${latched} newly latched`);
  }

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM monitored_users WHERE has_refinery_badge = 1'
  ).get() as { count: number };
  console.log(`🏭 Refinery badge sync complete: ${total.count} total badge holders`);
}
