import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import type { Agent } from 'undici';
import { fetch, fetchText, getAgent, isClientDestroyedError } from './http-client';

test('isClientDestroyedError terminates on cyclic error causes', () => {
  const a = new Error('foo') as Error & { cause?: unknown };
  const b = new Error('bar') as Error & { cause?: unknown };
  a.cause = b;
  b.cause = a;
  assert.equal(isClientDestroyedError(a), false);
});

test('does not retry POST by default on destroyed client, but retries GET and opt-in POST', async (t) => {
  let requests = 0;
  const server = createServer((_req, res) => {
    requests++;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert(addr && typeof addr === 'object');
  const url = `http://127.0.0.1:${addr.port}/foo`;

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  await (getAgent() as Agent).destroy();
  await assert.rejects(fetch(url, { method: 'POST' }));
  assert.equal(requests, 0);

  await (getAgent() as Agent).destroy();
  const getRes = await fetch(url);
  assert.equal(getRes.status, 200);
  assert.equal(requests, 1);

  await (getAgent() as Agent).destroy();
  const optInPost = await fetch(url, { method: 'POST', retry: true });
  assert.equal(optInPost.status, 200);
  assert.equal(requests, 2);

  const destroyed = getAgent() as Agent;
  await destroyed.destroy();
  await assert.rejects(fetchText(url, { method: 'POST' }));
  const recreated = getAgent();
  assert.notEqual(recreated, destroyed);
  assert.equal(requests, 2);
});
