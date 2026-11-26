import { NextResponse } from 'next/server';
import { rateLimitResponse } from '@/app/api/lib/rate-limit';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import { assertSameOrigin, clearLightningTokenCookie } from '@/lib/lightning-session';

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 30, 'lightning-logout');
  if (limited) return limited;

  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    let payload: { address?: unknown } | null;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.address !== 'string' ||
      !payload.address
    ) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const normalizedAddress = normalizeBitcoinAddress(payload.address);
    if (!isValidBitcoinAddress(normalizedAddress)) {
      return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    clearLightningTokenCookie(response, request, normalizedAddress);
    return response;
  } catch (error) {
    console.error('Error clearing lightning session:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}
