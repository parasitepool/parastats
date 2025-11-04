import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';

export interface AccountData {
  btc_address: string;
  ln_address: string | null;
  past_ln_addresses: string[];
  last_updated: string | null;
}

export interface AccountUpdate {
  btc_address: string,
  ln_address: string,
  signature: string,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }
    if (!isValidBitcoinAddress(address)) {
      return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
    }

    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to update user account: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to update user account" }, { status: 500 });
    }

    // Parse and validate request body
    let payload: Partial<AccountUpdate>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { btc_address, ln_address, signature } = payload as AccountUpdate;

    if (!btc_address || !ln_address || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: btc_address, ln_address, signature" },
        { status: 400 }
      );
    }
    if (btc_address !== address) {
      return NextResponse.json(
        { error: "btc_address in body must match URL address" },
        { status: 400 }
      );
    }
    if (!isValidBitcoinAddress(btc_address)) {
      return NextResponse.json({ error: "Invalid btc_address" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.API_TOKEN}`;
    }

    // Forward to upstream
    const upstream = await fetch(`${apiUrl}/account/update`, {
      method: "POST",
      headers,
      body: JSON.stringify({ btc_address, ln_address, signature }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => upstream.statusText);
      return NextResponse.json(
        { error: `Failed to update user account: ${text || upstream.statusText}` },
        { status: upstream.status }
      );
    }

    const accountData: AccountData = await upstream.json();
    return NextResponse.json(accountData);
  } catch (error) {
    console.error("Error updating user account:", error);
    return NextResponse.json({ error: "Failed to update user account" }, { status: 500 });
  }
}
