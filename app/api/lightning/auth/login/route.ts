import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const lightningApiUrl = process.env.LIGHTNING_API_URL;
    const identifier = process.env.LIGHTNING_API_IDENTIFIER;

    if (!identifier) {
      console.error('LIGHTNING_API_IDENTIFIER not configured');
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

    if (!address || !public_key || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Missing required fields: address, public_key, signature, nonce' },
        { status: 400 }
      );
    }

    const response = await fetch(
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
    console.error('Error during authentication:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}

