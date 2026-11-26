import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getLightningCookieName,
  serializeLightningCookieValue,
} from '@/lib/lightning-session';
import { handleLightningWithdrawRequest } from './handler';

const ADDR_A = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const ADDR_B = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

function createWithdrawRequest(
  body: string,
  cookieAddress?: string,
  origin = 'https://parasite.space',
): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'parasite.space',
    origin,
    'sec-fetch-site': 'same-origin',
  };
  if (cookieAddress) {
    headers.cookie = `${getLightningCookieName(cookieAddress)}=${serializeLightningCookieValue(cookieAddress, 'tok_foo')}`;
  }
  return new Request('https://parasite.space/api/lightning/withdraw', {
    method: 'POST',
    headers,
    body,
  });
}

test('rejects cross-origin and cross-address withdrawal attempts', async () => {
  const prevUrl = process.env.LIGHTNING_API_URL;
  process.env.LIGHTNING_API_URL = 'https://lightning.example';
  try {
    const crossOrigin = await handleLightningWithdrawRequest(
      createWithdrawRequest(JSON.stringify({ l1_address: ADDR_A }), ADDR_A, 'https://evil.example'),
      { upstreamAction: 'withdraw', fallbackError: 'fail', logLabel: 'fail' },
    );
    assert.equal(crossOrigin.status, 403);

    const crossAddress = await handleLightningWithdrawRequest(
      createWithdrawRequest(JSON.stringify({ l1_address: ADDR_B }), ADDR_A),
      { upstreamAction: 'withdraw', fallbackError: 'fail', logLabel: 'fail' },
    );
    assert.equal(crossAddress.status, 401);
  } finally {
    if (prevUrl === undefined) delete process.env.LIGHTNING_API_URL;
    else process.env.LIGHTNING_API_URL = prevUrl;
  }
});

test('clears cookie on upstream 401 and forwards valid response on 200', async () => {
  const prevUrl = process.env.LIGHTNING_API_URL;
  process.env.LIGHTNING_API_URL = 'https://lightning.example';
  let status = 401;
  const fetcher = async () => {
    if (status === 401) {
      return new Response('unauthorized', { status: 401 });
    }
    return Response.json({ hash: 'tx_bar' });
  };

  try {
    const expired = await handleLightningWithdrawRequest(
      createWithdrawRequest(JSON.stringify({ l1_address: ADDR_A }), ADDR_A),
      { upstreamAction: 'withdraw', fallbackError: 'fail', logLabel: 'fail', fetcher },
    );
    assert.equal(expired.status, 401);
    const setCookie = expired.headers.get('set-cookie') ?? '';
    assert.ok(setCookie.startsWith(`${getLightningCookieName(ADDR_A)}=;`));
    assert.match(setCookie, /Max-Age=0/);

    status = 200;
    const ok = await handleLightningWithdrawRequest(
      createWithdrawRequest(JSON.stringify({ l1_address: ADDR_A.toUpperCase() }), ADDR_A),
      { upstreamAction: 'withdraw', fallbackError: 'fail', logLabel: 'fail', fetcher },
    );
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { hash: 'tx_bar' });
  } finally {
    if (prevUrl === undefined) delete process.env.LIGHTNING_API_URL;
    else process.env.LIGHTNING_API_URL = prevUrl;
  }
});
