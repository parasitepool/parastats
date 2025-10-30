import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';

export interface AccountData {
  btc_address: string;
  ln_address: string | null;
  past_ln_addresses: string[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    if (!isValidBitcoinAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to fetch user account: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch user account" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/account/${address}`, {
      headers,
      next: { revalidate: 10 } // Cache for 10 seconds
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch user account: ${response.statusText}` },
        { status: response.status }
      );
    }

    const accountData: AccountData = await response.json();

    return NextResponse.json(accountData);
  } catch (error) {
    console.error("Error fetching user account:", error);
    return NextResponse.json(
      { error: "Failed to fetch user account" },
      { status: 500 }
    );
  }
}
