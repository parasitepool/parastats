import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';
import { rateLimitResponse } from '@/app/api/lib/rate-limit';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 20, 'lightning-nonce');
  if (limited) return limited;

  try {
    const lightningApiUrl = process.env.LIGHTNING_API_URL;
    const identifier = process.env.LIGHTNING_API_ID;

    if (!lightningApiUrl || !identifier) {
      console.error('LIGHTNING_API_URL or LIGHTNING_API_ID not configured');
      return NextResponse.json(
        { error: 'Lightning authentication not configured' },
        { status: 500 }
      );
    }

    let payload: { address?: unknown } | null;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.address !== 'string' ||
      !payload.address
    ) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = normalizeBitcoinAddress(payload.address);

    if (!isValidBitcoinAddress(normalizedAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    const response = await fetchWithTimeout(
      `${lightningApiUrl}/login/${encodeURIComponent(normalizedAddress)}/auth_nonce/${encodeURIComponent(identifier)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to request nonce: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ nonce: data.nonce });
  } catch (error) {
    console.error('Error requesting nonce:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to request nonce' },
      { status: 500 }
    );
  }
}
