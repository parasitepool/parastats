import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';
import { isValidBitcoinAddress } from '@/app/utils/validators';

export async function POST(request: Request) {
  try {
    const lightningApiUrl = process.env.LIGHTNING_API_URL;

    // Get lightning token from header
    const lightningToken = request.headers.get('X-Lightning-Token');
    if (!lightningToken) {
      return NextResponse.json(
        { error: 'Lightning token required' },
        { status: 401 }
      );
    }

    // Parse request body
    let payload: { l1_address?: string };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { l1_address } = payload;

    // Validate required fields
    if (!l1_address) {
      return NextResponse.json(
        { error: 'Missing required field: l1_address' },
        { status: 400 }
      );
    }

    // Validate Bitcoin address
    if (!isValidBitcoinAddress(l1_address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    // Make request to Lightning API
    const response = await fetchWithTimeout(
      `${lightningApiUrl}/wallet_user/${l1_address}/withdraw_quote`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lightningToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { error: `Failed to get withdraw quote: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting withdraw quote:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to get withdraw quote' },
      { status: 500 }
    );
  }
}

