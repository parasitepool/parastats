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

    let payload: {
      address?: string;
      public_key?: string;
      signature?: string;
      nonce?: string;
    };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { address, public_key, signature, nonce } = payload;

    // Validate required fields
    if (!address || !public_key || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Missing required fields: address, public_key, signature, nonce' },
        { status: 400 }
      );
    }

    // Validate input types and lengths
    if (
      typeof address !== 'string' ||
      typeof public_key !== 'string' ||
      typeof signature !== 'string' ||
      typeof nonce !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid field types' },
        { status: 400 }
      );
    }

    if (
      address.length < 10 || address.length > 100 ||
      public_key.length > 200 ||
      signature.length > 500 ||
      nonce.length > 200
    ) {
      return NextResponse.json(
        { error: 'Invalid field lengths' },
        { status: 400 }
      );
    }

    const response = await fetchWithTimeout(
      `${lightningApiUrl}/login/${address}/auth_sign/${identifier}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature,
          nonce,
          address,
          public_key,
          email: ''
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { error: `Authentication failed: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ token: data.token });
  } catch (error) {
    console.error('Error during authentication:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}

