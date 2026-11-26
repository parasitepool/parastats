import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';
import { rateLimitResponse } from '@/app/api/lib/rate-limit';
import { upstreamErrorResponse } from '@/app/api/lib/upstream-error';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import {
  assertSameOrigin,
  clearLightningTokenCookie,
  readLightningToken,
} from '@/lib/lightning-session';

interface WithdrawProxyOptions {
  upstreamAction: 'withdraw' | 'withdraw_quote';
  fallbackError: string;
  logLabel: string;
  fetcher?: typeof fetchWithTimeout;
}

export async function handleLightningWithdrawRequest(
  request: Request,
  options: WithdrawProxyOptions,
): Promise<NextResponse> {
  const isQuote = options.upstreamAction === 'withdraw_quote';
  const limited = rateLimitResponse(
    request,
    isQuote ? 20 : 5,
    isQuote ? 'lightning-withdraw-quote' : 'lightning-withdraw',
  );
  if (limited) return limited;

  const fetcher = options.fetcher ?? fetchWithTimeout;
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const lightningApiUrl = process.env.LIGHTNING_API_URL;
    if (!lightningApiUrl) {
      console.error('LIGHTNING_API_URL not configured');
      return NextResponse.json({ error: 'Lightning withdrawals not configured' }, { status: 500 });
    }

    let payload: { l1_address?: unknown } | null;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.l1_address !== 'string' ||
      !payload.l1_address
    ) {
      return NextResponse.json({ error: 'Missing required field: l1_address' }, { status: 400 });
    }

    const l1Address = normalizeBitcoinAddress(payload.l1_address);
    if (!isValidBitcoinAddress(l1Address)) {
      return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
    }

    const lightningToken = readLightningToken(request, l1Address);
    if (!lightningToken) {
      return NextResponse.json(
        { error: 'Lightning session expired', lightningTokenExpired: true },
        { status: 401 },
      );
    }

    const response = await fetcher(
      `${lightningApiUrl}/wallet_user/${encodeURIComponent(l1Address)}/${options.upstreamAction}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lightningToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status === 401) {
      const expired = NextResponse.json(
        { error: 'Lightning session expired', lightningTokenExpired: true },
        { status: 401 },
      );
      clearLightningTokenCookie(expired, request, l1Address);
      return expired;
    }

    if (!response.ok) {
      return upstreamErrorResponse(response, options.fallbackError, options.logLabel);
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error(
      `${options.logLabel}:`,
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json({ error: options.fallbackError }, { status: 500 });
  }
}
