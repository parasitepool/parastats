import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter, rateLimitResponse } from './rate-limit';

test('createRateLimiter enforces window limits and caps stored entries', () => {
  const realNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 2, maxEntries: 2 });

    assert.equal(limiter.check('foo').success, true);
    assert.equal(limiter.check('foo').success, true);
    assert.equal(limiter.check('foo').success, false);

    assert.equal(limiter.check('bar').success, true);
    assert.equal(limiter.size(), 2);

    assert.equal(limiter.check('baz').success, true);
    assert.equal(limiter.size(), 2);

    assert.equal(limiter.check('foo').success, true);

    now = 2_500;
    assert.equal(limiter.check('bar').success, true);
    assert.equal(limiter.size(), 1);
  } finally {
    Date.now = realNow;
  }
});

test('rateLimitResponse isolates buckets and returns 429 with rate-limit headers', () => {
  const req = new Request('https://parasite.space/api/test', {
    headers: { 'cf-connecting-ip': '203.0.113.42' },
  });

  assert.equal(rateLimitResponse(req, 1, 'bucket-foo'), null);
  const limited = rateLimitResponse(req, 1, 'bucket-foo');
  assert.ok(limited);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('x-ratelimit-remaining'), '0');
  assert.equal(limited.headers.get('cache-control'), 'no-store');

  assert.equal(rateLimitResponse(req, 1, 'bucket-bar'), null);
});
