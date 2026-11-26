import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';
import { rateLimitResponse } from '@/app/api/lib/rate-limit';
import { upstreamErrorResponse } from '@/app/api/lib/upstream-error';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import {
  assertSameOrigin,
  LIGHTNING_SESSION_MAX_AGE_SECONDS,
  setLightningTokenCookie,
} from '@/lib/lightning-session';

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 10, 'lightning-login');
  if (limited) return limited;

  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const lightningApiUrl = process.env.LIGHTNING_API_URL;
    const identifier = process.env.LIGHTNING_API_ID;

    if (!lightningApiUrl || !identifier) {
      console.error('LIGHTNING_API_URL or LIGHTNING_API_ID not configured');
      return NextResponse.json(
        { error: 'Lightning authentication not configured' },
        { status: 500 },
      );
    }

    let payload: {
      address?: unknown;
      public_key?: unknown;
      signature?: unknown;
      nonce?: unknown;
    } | null;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { address, public_key, signature, nonce } = payload;

    if (!address || !public_key || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Missing required fields: address, public_key, signature, nonce' },
        { status: 400 },
      );
    }

    if (
      typeof address !== 'string' ||
      typeof public_key !== 'string' ||
      typeof signature !== 'string' ||
      typeof nonce !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 });
    }

    const normalizedAddress = normalizeBitcoinAddress(address);

    if (
      !isValidBitcoinAddress(normalizedAddress) ||
      public_key.length > 200 ||
      signature.length > 500 ||
      nonce.length > 200
    ) {
      return NextResponse.json({ error: 'Invalid address or field lengths' }, { status: 400 });
    }

    const response = await fetchWithTimeout(
      `${lightningApiUrl}/login/${encodeURIComponent(normalizedAddress)}/auth_sign/${encodeURIComponent(identifier)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          nonce,
          address: normalizedAddress,
          public_key,
          email: '',
        }),
      },
    );

    if (!response.ok) {
      return upstreamErrorResponse(response, 'Authentication failed', 'Lightning login failed');
    }

    const data = (await response.json()) as { token?: unknown };
    if (typeof data.token !== 'string' || data.token.length === 0) {
      return NextResponse.json({ error: 'Invalid authentication response' }, { status: 502 });
    }

    const nextResponse = NextResponse.json(
      {
        authenticated: true,
        expiresAt: Date.now() + LIGHTNING_SESSION_MAX_AGE_SECONDS * 1000,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );

    setLightningTokenCookie(nextResponse, request, normalizedAddress, data.token);
    return nextResponse;
  } catch (error) {
    console.error('Error during authentication:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
  }
}
