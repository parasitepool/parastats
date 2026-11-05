import assert from 'node:assert/strict';
import test from 'node:test';
import { cachedJson } from './route-cache';

test('deduplicates concurrent requests and reuses a fresh response', async () => {
  let resolveFetch!: (value: string) => void;
  let calls = 0;
  const fetcher = () => {
    calls++;
    return new Promise<string>(resolve => { resolveFetch = resolve; });
  };

  const first = cachedJson('test:inflight', 10_000, fetcher);
  const second = cachedJson('test:inflight', 10_000, fetcher);
  resolveFetch('ok');

  assert.deepEqual(await Promise.all([first, second]), ['ok', 'ok']);
  assert.equal(await cachedJson('test:inflight', 10_000, fetcher), 'ok');
  assert.equal(calls, 1);
});

test('does not cache unsuccessful upstream responses', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { status: calls === 1 ? 503 : 200 };
  };
  const shouldCache = (result: { status: number }) => result.status === 200;

  assert.deepEqual(await cachedJson('test:errors', 10_000, fetcher, shouldCache), { status: 503 });
  assert.deepEqual(await cachedJson('test:errors', 10_000, fetcher, shouldCache), { status: 200 });
  assert.equal(calls, 2);
});

test('returns an upstream error rather than an expired successful response', async () => {
  const realNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  const shouldCache = (result: { status: number }) => result.status === 200;

  try {
    await cachedJson('test:upstream-error', 10_000, async () => ({ status: 200 }), shouldCache);
    now = 11_001;
    assert.deepEqual(await cachedJson('test:upstream-error', 10_000, async () => ({ status: 503 }), shouldCache), {
      status: 503,
    });
    assert.deepEqual(await cachedJson('test:upstream-error', 10_000, async () => ({ status: 200 }), shouldCache), {
      status: 200,
    });
  } finally {
    Date.now = realNow;
  }
});

test('rejects failed refreshes instead of serving expired data', async () => {
  const realNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    await cachedJson('test:refresh-error', 10_000, async () => 'last good value');
    now = 11_001;
    const failedRefresh = async (): Promise<string> => { throw new Error('offline'); };
    await assert.rejects(cachedJson('test:refresh-error', 10_000, failedRefresh), /offline/);
  } finally {
    Date.now = realNow;
  }
});
