import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { getLightningCookieName } from '@/lib/lightning-session';
import { POST } from './route';

const ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

function createRequest(body: unknown, origin = 'https://parasite.space'): Request {
  return new Request('https://parasite.space/api/lightning/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'parasite.space',
      origin,
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  });
}

test('login sets HttpOnly cookie, normalizes address, and rejects bad origin or empty token', async (t) => {
  let tokenResponse: unknown = { token: 'tok_foo' };
  let lastPath = '';

  const server = createServer((req, res) => {
    lastPath = req.url ?? '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tokenResponse));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert(addr && typeof addr === 'object');

  const prevUrl = process.env.LIGHTNING_API_URL;
  const prevId = process.env.LIGHTNING_API_ID;
  process.env.LIGHTNING_API_URL = `http://127.0.0.1:${addr.port}`;
  process.env.LIGHTNING_API_ID = 'bar';

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    if (prevUrl === undefined) delete process.env.LIGHTNING_API_URL;
    else process.env.LIGHTNING_API_URL = prevUrl;
    if (prevId === undefined) delete process.env.LIGHTNING_API_ID;
    else process.env.LIGHTNING_API_ID = prevId;
  });

  const payload = {
    address: ADDR.toUpperCase(),
    public_key: 'pub_foo',
    signature: 'sig_foo',
    nonce: 'nonce_foo',
  };

  assert.equal((await POST(createRequest(payload, 'https://evil.example'))).status, 403);

  const ok = await POST(createRequest(payload));
  assert.equal(ok.status, 200);
  assert.equal(lastPath, `/login/${ADDR}/auth_sign/bar`);
  assert.equal((await ok.json()).authenticated, true);
  const cookie = ok.headers.get('set-cookie') ?? '';
  assert.ok(cookie.startsWith(`${getLightningCookieName(ADDR)}=`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Path=\/api/i);

  tokenResponse = { token: '' };
  assert.equal((await POST(createRequest(payload))).status, 502);
});
