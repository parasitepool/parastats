import assert from 'node:assert/strict';
import test from 'node:test';
import { NextResponse } from 'next/server';
import {
  assertSameOrigin,
  clearLightningTokenCookie,
  getLightningCookieName,
  isSecureRequest,
  parseCookieHeader,
  parseLightningCookieValue,
  readLightningToken,
  serializeLightningCookieValue,
  setLightningTokenCookie,
} from './lightning-session';

const ADDR_A = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const ADDR_B = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

test('cookie name normalizes uppercase bech32 addresses', () => {
  assert.equal(getLightningCookieName(ADDR_A), getLightningCookieName(ADDR_A.toUpperCase()));
  assert.notEqual(getLightningCookieName(ADDR_A), getLightningCookieName(ADDR_B));
});

test('cookie value binds token to exact normalized address', () => {
  const serialized = serializeLightningCookieValue(ADDR_A.toUpperCase(), 'tok_foo');

  assert.equal(parseLightningCookieValue(serialized, ADDR_A), 'tok_foo');
  assert.equal(parseLightningCookieValue(serialized, ADDR_A.toUpperCase()), 'tok_foo');
  assert.equal(parseLightningCookieValue(serialized, ADDR_B), null);
  assert.equal(parseLightningCookieValue('not-valid', ADDR_A), null);
});

test('readLightningToken isolates sessions per address', () => {
  const cookieHeader = [
    `${getLightningCookieName(ADDR_A)}=${serializeLightningCookieValue(ADDR_A, 'tok_a')}`,
    `${getLightningCookieName(ADDR_B)}=${serializeLightningCookieValue(ADDR_B, 'tok_b')}`,
  ].join('; ');

  const request = new Request('https://parasite.space/api/account', {
    headers: { cookie: cookieHeader },
  });

  assert.equal(readLightningToken(request, ADDR_A), 'tok_a');
  assert.equal(readLightningToken(request, ADDR_B), 'tok_b');
});

test('readLightningToken rejects forged cookie whose inner address mismatches', () => {
  const forged = serializeLightningCookieValue(ADDR_B, 'tok_b');
  const request = new Request('https://parasite.space/api/account', {
    headers: { cookie: `${getLightningCookieName(ADDR_A)}=${forged}` },
  });

  assert.equal(readLightningToken(request, ADDR_A), null);
});

test('isSecureRequest respects cf-visitor, x-forwarded-proto, and URL protocol', () => {
  assert.equal(isSecureRequest(new Request('https://parasite.space/api')), true);
  assert.equal(isSecureRequest(new Request('http://localhost:3000/api')), false);
  assert.equal(
    isSecureRequest(new Request('http://internal/api', { headers: { 'x-forwarded-proto': 'https' } })),
    true,
  );
  assert.equal(
    isSecureRequest(new Request('https://internal/api', { headers: { 'x-forwarded-proto': 'http' } })),
    false,
  );
  assert.equal(
    isSecureRequest(
      new Request('http://internal/api', {
        headers: { 'x-forwarded-proto': 'http', 'cf-visitor': '{"scheme":"https"}' },
      }),
    ),
    true,
  );
  assert.equal(
    isSecureRequest(
      new Request('http://internal/api', { headers: { 'cf-visitor': '{"scheme":"http"}' } }),
    ),
    false,
  );
});

test('cookie helpers preserve flags and parse values containing =', () => {
  const req = new Request('http://internal/api', {
    headers: { 'cf-visitor': '{"scheme":"https"}' },
  });
  const setRes = NextResponse.json({ ok: true });
  setLightningTokenCookie(setRes, req, ADDR_A, 'tok_foo');
  const setCookie = setRes.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  assert.match(setCookie, /Path=\/api/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Max-Age=86400/i);

  const clearRes = NextResponse.json({ ok: true });
  clearLightningTokenCookie(clearRes, req, ADDR_A);
  const clearCookie = clearRes.headers.get('set-cookie') ?? '';
  assert.match(clearCookie, /Max-Age=0/i);
  assert.match(clearCookie, /Secure/i);

  const parsed = parseCookieHeader('foo=a=b==; bar=baz');
  assert.equal(parsed.get('foo'), 'a=b==');
  assert.equal(parsed.get('bar'), 'baz');
});

test('assertSameOrigin allows same-origin and blocks cross-origin requests', () => {
  const caseOrigin = (url: string, headers: Record<string, string>, expected: boolean) => {
    const req = new Request(url, { method: 'POST', headers });
    assert.equal(assertSameOrigin(req), expected);
  };

  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', origin: 'https://parasite.space', 'sec-fetch-site': 'same-origin' },
    true,
  );
  caseOrigin(
    'http://127.0.0.1:3000/api/lightning/withdraw',
    { host: '127.0.0.1:3000', 'x-forwarded-host': 'parasite.space', origin: 'https://parasite.space' },
    true,
  );
  caseOrigin(
    'http://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', referer: 'https://parasite.space/user/foo' },
    true,
  );
  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', 'sec-fetch-site': 'same-origin' },
    true,
  );
  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', origin: 'https://evil.example' },
    false,
  );
  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', origin: 'https://parasite.space', 'sec-fetch-site': 'cross-site' },
    false,
  );
  caseOrigin(
    'http://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', referer: 'https://evil.example/page' },
    false,
  );
  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space' },
    false,
  );
  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', origin: 'null' },
    false,
  );
  caseOrigin(
    'https://parasite.space/api/lightning/withdraw',
    { host: 'parasite.space', origin: 'http://parasite.space' },
    false,
  );
});
