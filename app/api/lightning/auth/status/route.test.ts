import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getLightningCookieName,
  serializeLightningCookieValue,
} from '@/lib/lightning-session';
import { GET } from './route';

const ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

test('status validates address and checks address-scoped cookie', async () => {
  assert.equal((await GET(new Request('https://parasite.space/api/lightning/auth/status'))).status, 400);
  assert.equal(
    (await GET(new Request('https://parasite.space/api/lightning/auth/status?address=invalid'))).status,
    400,
  );

  const unauth = await GET(
    new Request(`https://parasite.space/api/lightning/auth/status?address=${ADDR}`),
  );
  assert.equal(unauth.status, 200);
  assert.deepEqual(await unauth.json(), { authenticated: false });

  const auth = await GET(
    new Request(`https://parasite.space/api/lightning/auth/status?address=${ADDR.toUpperCase()}`, {
      headers: {
        cookie: `${getLightningCookieName(ADDR)}=${serializeLightningCookieValue(ADDR, 'tok_foo')}`,
      },
    }),
  );
  assert.equal(auth.status, 200);
  assert.deepEqual(await auth.json(), { authenticated: true });
});
