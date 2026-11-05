import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOrderQuote, orderQuoteNeedsConfirmation, type OrderQuote } from './refinery-quote';

const status = {
  hash_price: 47_051,
  halt: false,
  wallet: { synced: true },
};

test('fresh quote requests bypass the status cache', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async input => {
    urls.push(String(input));
    return Response.json(status);
  };

  await fetchOrderQuote(false, fetcher);
  await fetchOrderQuote(true, fetcher);

  assert.deepEqual(urls, ['/api/refinery/status', '/api/refinery/status?fresh=1']);
});

test('quote confirmation tolerates price movements up to one percent', () => {
  const quote: OrderQuote = { price: 10_000, halt: false, walletSynced: true };

  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote }), false);
  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, price: 10_001 }), false);
  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, price: 9_900 }), false);
  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, price: 10_100 }), false);
  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, price: 9_899 }), true);
  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, price: 10_101 }), true);
});

test('quote confirmation is required for availability changes', () => {
  const quote: OrderQuote = { price: 10_000, halt: false, walletSynced: true };

  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, halt: true }), true);
  assert.equal(orderQuoteNeedsConfirmation(quote, { ...quote, walletSynced: false }), true);
});
