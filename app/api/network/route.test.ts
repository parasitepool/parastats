import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { GET } from './route';

test('network data caches, preserves the last known height, and falls back to stale data', async t => {
  let hashrateStatus = 200;
  let heightStatus = 200;
  let hashrateMalformed = false;
  let hashrateRequests = 0;
  let heightRequests = 0;

  const server = createServer((request, response) => {
    if (request.url === '/api/v1/mining/hashrate/3d') {
      hashrateRequests++;
      response.writeHead(hashrateStatus, { 'Content-Type': 'application/json' });
      response.end(hashrateMalformed
        ? JSON.stringify({ currentHashrate: 'not a number', currentDifficulty: 1e14 })
        : JSON.stringify({ currentHashrate: 6.5e20, currentDifficulty: 1.1e14 }));
      return;
    }
    if (request.url === '/api/blocks/tip/height') {
      heightRequests++;
      response.writeHead(heightStatus, { 'Content-Type': 'text/plain' });
      response.end('900000');
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  const previousBase = process.env.MEMPOOL_API_URL;
  const previousTtl = process.env.NETWORK_CACHE_TTL_MS;
  process.env.MEMPOOL_API_URL = `http://127.0.0.1:${address.port}`;
  // Long enough to observe cache hits; set to 0 below to force refetches.
  process.env.NETWORK_CACHE_TTL_MS = '60000';

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    if (previousBase === undefined) delete process.env.MEMPOOL_API_URL;
    else process.env.MEMPOOL_API_URL = previousBase;
    if (previousTtl === undefined) delete process.env.NETWORK_CACHE_TTL_MS;
    else process.env.NETWORK_CACHE_TTL_MS = previousTtl;
  });

  const readOk = async (response: Response) => {
    assert.equal(response.status, 200);
    return await response.json() as { hashrate: number; difficulty: number; height: number | null };
  };

  // Cold cache with both upstreams down: no stale data to serve, so 502.
  hashrateStatus = 503;
  heightStatus = 500;
  assert.equal((await GET()).status, 502);
  assert.equal(hashrateRequests, 1);
  assert.equal(heightRequests, 1);

  // Cold success fills the cache, including the tip height.
  hashrateStatus = 200;
  heightStatus = 200;
  const fresh = await readOk(await GET());
  assert.equal(fresh.hashrate, 6.5e20);
  assert.equal(fresh.difficulty, 1.1e14);
  assert.equal(fresh.height, 900000);
  assert.equal(hashrateRequests, 2);
  assert.equal(heightRequests, 2);

  // Within the TTL the cache serves without new upstream calls.
  const cached = await readOk(await GET());
  assert.deepEqual(
    [cached.hashrate, cached.difficulty, cached.height],
    [6.5e20, 1.1e14, 900000],
  );
  assert.equal(hashrateRequests, 2);
  assert.equal(heightRequests, 2);

  // Expire the cache and take the tip endpoint down: a failed tip refresh
  // must not evict the last known height.
  process.env.NETWORK_CACHE_TTL_MS = '0';
  heightStatus = 500;
  const preserved = await readOk(await GET());
  assert.equal(preserved.hashrate, 6.5e20);
  assert.equal(preserved.height, 900000);
  assert.equal(hashrateRequests, 3);
  assert.equal(heightRequests, 3);

  // Once the tip endpoint recovers, the height refreshes again.
  heightStatus = 200;
  const recovered = await readOk(await GET());
  assert.equal(recovered.height, 900000);
  assert.equal(heightRequests, 4);

  // A hashrate failure serves the stale cache (never a 502 once cached).
  hashrateStatus = 503;
  const fallback = await readOk(await GET());
  assert.equal(fallback.hashrate, 6.5e20);
  assert.equal(fallback.difficulty, 1.1e14);
  assert.equal(fallback.height, 900000);
  assert.equal(hashrateRequests, 5);

  // So does a malformed hashrate payload.
  hashrateStatus = 200;
  hashrateMalformed = true;
  const malformed = await readOk(await GET());
  assert.equal(malformed.hashrate, 6.5e20);
  assert.equal(malformed.height, 900000);
  assert.equal(hashrateRequests, 6);
});
