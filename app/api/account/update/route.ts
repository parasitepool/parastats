import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import type { AccountUpdate } from '@/app/api/account/types';

export async function POST(request: Request) {
  try {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to update user account: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to update user account" }, { status: 500 });
    }

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
                
    if (!isValidBitcoinAddress(btc_address)) {
      return NextResponse.json({ error: "Invalid btc_address" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/account/update`, {
      method: "POST",
      headers,
      body: JSON.stringify({ btc_address, ln_address, signature }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { error: `Failed to update user account: ${text || response.statusText}` },
        { status: response.status }
      );
    }

    const accountData = await response.json();

    return NextResponse.json(accountData);
  } catch (error) {
    console.error("Error updating user account:", error);
    return NextResponse.json({ error: "Failed to update user account" }, { status: 500 });
  }
}
