import assert from 'node:assert/strict';
import test from 'node:test';
import { getLightningCookieName } from '@/lib/lightning-session';
import { POST } from './route';

const ADDR_A = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

function createRequest(body: string, origin = 'https://parasite.space'): Request {
  return new Request('https://parasite.space/api/lightning/auth/logout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'parasite.space',
      origin,
      'sec-fetch-site': 'same-origin',
    },
    body,
  });
}

test('logout clears only the requested address cookie', async () => {
  const response = await POST(createRequest(JSON.stringify({ address: ADDR_A })));

  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.ok(cookie.startsWith(`${getLightningCookieName(ADDR_A)}=;`));
  assert.match(cookie, /Max-Age=0/);
});

test('logout rejects cross-origin and malformed requests', async () => {
  assert.equal(
    (await POST(createRequest(JSON.stringify({ address: ADDR_A }), 'https://evil.example'))).status,
    403,
  );
  assert.equal((await POST(createRequest('null'))).status, 400);
  assert.equal((await POST(createRequest('{}'))).status, 400);
  assert.equal((await POST(createRequest(JSON.stringify({ address: 'invalid' })))).status, 400);
});
