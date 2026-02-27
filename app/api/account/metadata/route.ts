import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import type { AccountMetadataUpdate } from '@/app/api/account/types';

export async function POST(request: Request) {
  try {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to update account metadata: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to update account metadata" }, { status: 500 });
    }

    let payload: Partial<AccountMetadataUpdate>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { btc_address, metadata, signature } = payload as AccountMetadataUpdate;

    if (!btc_address || !metadata || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: btc_address, metadata, signature" },
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

    const response = await fetch(`${apiUrl}/account/metadata`, {
      method: "POST",
      headers,
      body: JSON.stringify({ btc_address, metadata, signature }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { error: `Failed to update account metadata: ${text || response.statusText}` },
        { status: response.status }
      );
    }

    const accountData = await response.json();

    return NextResponse.json(accountData);
  } catch (error) {
    console.error("Error updating account metadata:", error);
    return NextResponse.json({ error: "Failed to update account metadata" }, { status: 500 });
  }
}
