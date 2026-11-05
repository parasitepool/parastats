export interface OrderQuote {
  price: number;
  halt: boolean;
  walletSynced: boolean;
}

export const QUOTE_FETCH_ERROR = 'Could not refresh the refinery quote. Please try again.';

export function orderQuoteNeedsConfirmation(reviewed: OrderQuote, latest: OrderQuote): boolean {
  return reviewed.halt !== latest.halt ||
    reviewed.walletSynced !== latest.walletSynced ||
    Math.abs(latest.price - reviewed.price) > reviewed.price * 0.01;
}

export async function fetchOrderQuote(
  fresh = false,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<OrderQuote> {
  let response: Response;
  try {
    response = await fetcher(`/api/refinery/status${fresh ? '?fresh=1' : ''}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(QUOTE_FETCH_ERROR);
  }
  if (!response.ok) throw new Error(QUOTE_FETCH_ERROR);

  const status = await response.json();
  if (!Number.isSafeInteger(status?.hash_price) || status.hash_price <= 0 ||
      typeof status.halt !== 'boolean' || typeof status.wallet?.synced !== 'boolean') {
    throw new Error('The refinery returned an invalid quote. Please try again.');
  }

  return { price: status.hash_price, halt: status.halt, walletSynced: status.wallet.synced };
}
