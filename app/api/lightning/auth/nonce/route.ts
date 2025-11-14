import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';

export async function POST(request: Request) {
  try {
    const lightningApiUrl = process.env.LIGHTNING_API_URL || 'https://api.bitbit.bot';
    const identifier = process.env.LIGHTNING_API_ID;

    if (!identifier) {
      console.error('LIGHTNING_API_ID not configured');
      return NextResponse.json(
        { error: 'Lightning authentication not configured' },
        { status: 500 }
      );
    }

    let payload: { address?: string };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { address } = payload;

    // Validate address input
    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    if (address.length < 10 || address.length > 100) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    const response = await fetchWithTimeout(
      `${lightningApiUrl}/login/${address}/auth_nonce/${identifier}`,
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

