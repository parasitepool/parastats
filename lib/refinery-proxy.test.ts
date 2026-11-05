import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchRouterResponse } from './refinery-proxy';

test('does not replay a POST when the response is lost', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    throw new Error('response lost');
  });

  await assert.rejects(
    fetchRouterResponse('http://router.example/api/router/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash_days: 1e15 }),
    }),
    /response lost/,
  );
  assert.equal(requests, 1);
});
