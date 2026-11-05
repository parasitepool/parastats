import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';

test('fresh status requests bypass the cache and use a separate strict limit', async t => {
  let hashPrice = 47_051;
  let upstreamRequests = 0;
  const server = createServer((request, response) => {
    if (request.url !== '/api/router/status') {
      response.writeHead(404).end();
      return;
    }

    upstreamRequests++;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      hash_price: hashPrice,
      halt: false,
      wallet: { synced: true },
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  const previousRouterBase = process.env.ROUTER_API_URL;
  process.env.ROUTER_API_URL = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    if (previousRouterBase === undefined) delete process.env.ROUTER_API_URL;
    else process.env.ROUTER_API_URL = previousRouterBase;
  });

  const request = (fresh = false) => new NextRequest(
    `http://parastats.test/api/refinery/status${fresh ? '?fresh=1' : ''}`,
  );
  const readHashPrice = async (response: Response) => {
    assert.equal(response.status, 200);
    return (await response.json()).hash_price;
  };

  assert.equal(await readHashPrice(await GET(request())), 47_051);
  assert.equal(upstreamRequests, 1);

  hashPrice = 48_000;
  assert.equal(await readHashPrice(await GET(request())), 47_051);
  assert.equal(upstreamRequests, 1);

  assert.equal(await readHashPrice(await GET(request(true))), 48_000);
  assert.equal(upstreamRequests, 2);

  for (let requestNumber = 1; requestNumber < 10; requestNumber++) {
    assert.equal((await GET(request(true))).status, 200);
  }
  assert.equal(upstreamRequests, 11);
  assert.equal((await GET(request(true))).status, 429);
  assert.equal(upstreamRequests, 11);
});
