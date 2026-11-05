import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrderSummary } from '@/app/api/refinery/types';
import { buildOrdersPageUrl, fetchOrdersPage } from './refinery-orders';

function order(id: number): OrderSummary {
  return {
    id,
    status: 'active',
    review: 'clean',
    endpoint: 'parasite.wtf:42068',
    username: 'worker',
    requested_hash_days: 1,
    hashrate: id,
    delivered_hash_days: 0,
    best_share: null,
  };
}

test('builds orders page URLs with the 10-row page size and cursor', () => {
  const first = buildOrdersPageUrl(
    '/api/refinery/orders?status=active,in_mempool&kind=bucket',
    null,
  );
  const parsed = new URL(first, 'http://localhost');
  assert.equal(parsed.searchParams.get('limit'), '10');
  assert.equal(parsed.searchParams.get('status'), 'active,in_mempool');
  assert.equal(parsed.searchParams.get('kind'), 'bucket');
  assert.equal(parsed.searchParams.has('cursor'), false);

  const next = new URL(buildOrdersPageUrl(first, '42'), 'http://localhost');
  assert.equal(next.searchParams.get('limit'), '10');
  assert.equal(next.searchParams.get('cursor'), '42');
});

test('returns one current page and its next cursor', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify([order(2), order(1)]), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Next-Cursor': '1' },
  })) as typeof fetch;

  try {
    const result = await fetchOrdersPage('/api/refinery/orders', null, new AbortController().signal);
    assert.deepEqual(result.orders.map(item => item.id), [2, 1]);
    assert.equal(result.nextCursor, '1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects a repeated pagination cursor', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify([order(1)]), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Next-Cursor': '1' },
  })) as typeof fetch;

  try {
    await assert.rejects(
      fetchOrdersPage('/api/refinery/orders', '1', new AbortController().signal),
      /repeated cursor/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
