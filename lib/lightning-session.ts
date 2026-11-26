import { createHash } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { normalizeBitcoinAddress } from '@/app/utils/validators';

export const LIGHTNING_COOKIE_PREFIX = 'parasite_ln_';
export const LIGHTNING_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function getLightningCookieName(address: string): string {
  const normalized = normalizeBitcoinAddress(address);
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `${LIGHTNING_COOKIE_PREFIX}${digest}`;
}

export function serializeLightningCookieValue(address: string, token: string): string {
  const payload = JSON.stringify({
    address: normalizeBitcoinAddress(address),
    token,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function parseLightningCookieValue(raw: string, expectedAddress: string): string | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    if (
      typeof record.address !== 'string' ||
      typeof record.token !== 'string' ||
      record.token.length === 0
    ) {
      return null;
    }

    if (record.address !== normalizeBitcoinAddress(expectedAddress)) {
      return null;
    }

    return record.token;
  } catch {
    return null;
  }
}

export function parseCookieHeader(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) {
      cookies.set(name, value);
    }
  }

  return cookies;
}

export function readLightningToken(request: Request, address: string): string | null {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const raw = cookies.get(getLightningCookieName(address));
  if (!raw) return null;
  return parseLightningCookieValue(raw, address);
}

function parseCfVisitorScheme(header: string | null): string | null {
  if (!header) return null;
  try {
    const parsed: unknown = JSON.parse(header);
    if (parsed && typeof parsed === 'object' && 'scheme' in parsed) {
      const scheme = (parsed as { scheme?: unknown }).scheme;
      return typeof scheme === 'string' ? scheme.toLowerCase() : null;
    }
  } catch {
  }
  return null;
}

export function isSecureRequest(request: Request): boolean {
  const cfScheme = parseCfVisitorScheme(request.headers.get('cf-visitor'));
  if (cfScheme) {
    return cfScheme === 'https';
  }
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwardedProto) {
    return forwardedProto === 'https';
  }
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function setLightningTokenCookie(
  response: NextResponse,
  request: Request,
  address: string,
  token: string,
): void {
  response.cookies.set(
    getLightningCookieName(address),
    serializeLightningCookieValue(address, token),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureRequest(request),
      path: '/api',
      maxAge: LIGHTNING_SESSION_MAX_AGE_SECONDS,
    },
  );
}

export function clearLightningTokenCookie(
  response: NextResponse,
  request: Request,
  address: string,
): void {
  response.cookies.set(getLightningCookieName(address), '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(request),
    path: '/api',
    maxAge: 0,
  });
}

export function assertSameOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return false;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const sourceUrl = origin || referer;
  if (!sourceUrl) {
    return secFetchSite === 'same-origin';
  }

  let parsedSource: URL;
  try {
    parsedSource = new URL(sourceUrl);
  } catch {
    return false;
  }

  if (parsedSource.protocol !== 'http:' && parsedSource.protocol !== 'https:') {
    return false;
  }

  if (isSecureRequest(request) && parsedSource.protocol !== 'https:') {
    return false;
  }

  const sourceHost = parsedSource.host.toLowerCase();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
  const hostHeader = request.headers.get('host')?.trim().toLowerCase();
  const expectedHost = forwardedHost || hostHeader || (() => {
    try {
      return new URL(request.url).host.toLowerCase();
    } catch {
      return '';
    }
  })();

  return expectedHost.length > 0 && sourceHost === expectedHost;
}
