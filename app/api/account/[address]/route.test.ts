import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  getLightningCookieName,
  serializeLightningCookieValue,
} from '@/lib/lightning-session';
import { GET } from './route';

const ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

test('account route reports lightning expiration for missing cookie and upstream 401', async (t) => {
  let lightningStatus = 401;
  let lightningCalls = 0;

  const server = createServer((req, res) => {
    if (req.url === `/account/${ADDR}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ btc_address: ADDR, ln_address: 'foo@bar.com' }));
      return;
    }
    if (req.url === '/wallet_user' || req.url === '/wallet_user/balance') {
      lightningCalls++;
      res.writeHead(lightningStatus, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          req.url === '/wallet_user' ? { username: 'foo' } : { balance: 9000 },
        ),
      );
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const prevApi = process.env.API_URL;
  const prevLn = process.env.LIGHTNING_API_URL;
  process.env.API_URL = baseUrl;
  process.env.LIGHTNING_API_URL = baseUrl;

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    if (prevApi === undefined) delete process.env.API_URL;
    else process.env.API_URL = prevApi;
    if (prevLn === undefined) delete process.env.LIGHTNING_API_URL;
    else process.env.LIGHTNING_API_URL = prevLn;
  });

  const withoutFlag = await GET(
    new Request(`https://parasite.space/api/account/${ADDR}`),
    { params: Promise.resolve({ address: ADDR }) },
  );
  assert.equal(withoutFlag.status, 200);
  const withoutFlagBody = await withoutFlag.json();
  assert.equal(withoutFlagBody.lightning, null);
  assert.equal(withoutFlagBody.lightningTokenExpired, undefined);
  assert.equal(lightningCalls, 0);

  const missingCookie = await GET(
    new Request(`https://parasite.space/api/account/${ADDR}?includeLightning=1`),
    { params: Promise.resolve({ address: ADDR }) },
  );
  assert.equal(missingCookie.status, 200);
  const missingBody = await missingCookie.json();
  assert.equal(missingBody.lightning, null);
  assert.equal(missingBody.lightningTokenExpired, true);
  assert.equal(lightningCalls, 0);

  const cookie = `${getLightningCookieName(ADDR)}=${serializeLightningCookieValue(ADDR, 'tok_foo')}`;
  const expiredUpstream = await GET(
    new Request(`https://parasite.space/api/account/${ADDR}?includeLightning=1`, {
      headers: { cookie },
    }),
    { params: Promise.resolve({ address: ADDR }) },
  );
  assert.equal(expiredUpstream.status, 200);
  assert.equal((await expiredUpstream.json()).lightningTokenExpired, true);
  const setCookie = expiredUpstream.headers.get('set-cookie') ?? '';
  assert.ok(setCookie.startsWith(`${getLightningCookieName(ADDR)}=;`));
  assert.match(setCookie, /Max-Age=0/);

  lightningStatus = 200;
  const ok = await GET(
    new Request(`https://parasite.space/api/account/${ADDR}?includeLightning=1`, {
      headers: { cookie },
    }),
    { params: Promise.resolve({ address: ADDR }) },
  );
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).lightning, {
    walletInfo: { username: 'foo' },
    balance: 9000,
  });
});
