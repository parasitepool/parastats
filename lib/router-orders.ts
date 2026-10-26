import { fetch } from './http-client';
import type { OrderSummary } from '@/app/api/router/types';

/**
 * The router caps list pages at 500 entries. Request the maximum so most
 * filtered lists fit in a single request while still following
 * `X-Next-Cursor` for larger result sets.
 */
const PAGE_SIZE = 500;

/** Stop if the router keeps returning cursors, so a bad response can't loop. */
const MAX_PAGES = 100;

export type RouterOrderParams = Record<string, string | undefined>;

export function routerAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (process.env.ROUTER_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.ROUTER_API_TOKEN}`;
  }
  return headers;
}

interface RouterOrdersPage {
  orders: OrderSummary[];
  nextCursor: string | null;
}

async function fetchRouterOrdersPage(
  routerBase: string,
  params: RouterOrderParams,
  cursor: string | null,
): Promise<RouterOrdersPage> {
  const url = new URL(`${routerBase}/api/router/orders`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set('limit', String(PAGE_SIZE));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url, { cache: 'no-store', headers: routerAuthHeaders() });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Router orders failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Router orders returned a non-JSON response');
  }

  const orders = (await res.json()) as OrderSummary[];
  return { orders, nextCursor: res.headers.get('x-next-cursor') };
}

/**
 * Fetch every order matching `params`, following the router's keyset cursor.
 *
 * The pre-pagination router returns the whole (limit-capped) list without an
 * `X-Next-Cursor` header, so this also works during the transition.
 */
export async function fetchAllRouterOrders(
  routerBase: string,
  params: RouterOrderParams = {},
): Promise<OrderSummary[]> {
  const orders: OrderSummary[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchRouterOrdersPage(routerBase, params, cursor);
    orders.push(...result.orders);

    if (!result.nextCursor) return orders;
    if (seenCursors.has(result.nextCursor)) {
      throw new Error(`Router orders pagination repeated cursor ${result.nextCursor}`);
    }

    seenCursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  throw new Error(`Router orders pagination exceeded ${MAX_PAGES} pages`);
}
