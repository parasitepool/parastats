import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRouterOrdersUrl } from './router-orders';

test('forwards order query params without adding a limit', () => {
  const url = buildRouterOrdersUrl('https://router.example', {
    status: 'active,in_mempool',
    kind: 'bucket',
  });

  assert.equal(url.pathname, '/api/router/orders');
  assert.equal(url.searchParams.get('status'), 'active,in_mempool');
  assert.equal(url.searchParams.get('kind'), 'bucket');
  assert.equal(url.searchParams.has('limit'), false);
  assert.equal(url.searchParams.has('cursor'), false);
});

test('forwards explicit limit and cursor unchanged', () => {
  const url = buildRouterOrdersUrl('https://router.example', {
    address: 'bc1qexample',
    limit: '500',
    cursor: '42',
  });

  assert.equal(url.searchParams.get('address'), 'bc1qexample');
  assert.equal(url.searchParams.get('limit'), '500');
  assert.equal(url.searchParams.get('cursor'), '42');
});
