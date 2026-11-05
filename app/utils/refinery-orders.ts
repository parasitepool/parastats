import type { OrderSummary } from '@/app/api/refinery/types';

export const ORDERS_PAGE_SIZE = 10;

export interface OrdersPage {
  orders: OrderSummary[];
  nextCursor: string | null;
}

/** Build a relative orders URL with the page size used by the UI. */
export function buildOrdersPageUrl(url: string, cursor: string | null): string {
  const parsed = new URL(url, 'http://localhost');
  parsed.searchParams.set('limit', String(ORDERS_PAGE_SIZE));
  if (cursor) parsed.searchParams.set('cursor', cursor);
  else parsed.searchParams.delete('cursor');
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export async function fetchOrdersPage(
  url: string,
  cursor: string | null,
  signal: AbortSignal,
): Promise<OrdersPage> {
  const response = await fetch(buildOrdersPageUrl(url, cursor), { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Orders unavailable');

  const orders = await response.json() as OrderSummary[];
  if (!Array.isArray(orders)) throw new Error('Invalid orders response');

  const nextCursor = response.headers.get('x-next-cursor') || null;
  if (nextCursor && nextCursor === cursor) throw new Error('Orders pagination repeated cursor');

  return { orders, nextCursor };
}
