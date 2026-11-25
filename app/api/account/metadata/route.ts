import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { upstreamErrorResponse } from '@/app/api/lib/upstream-error';
import type { AccountMetadataUpdate } from '@/app/api/account/types';
import { getDb } from '@/lib/db';
import { invalidateRouteCache } from '@/lib/route-cache';

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

    const ALLOWED_METADATA_FIELDS: string[] = ['is_private'];
    const invalidFields = Object.keys(metadata).filter(key => !ALLOWED_METADATA_FIELDS.includes(key));
    if (invalidFields.length > 0) {
      return NextResponse.json(
        { error: `Invalid metadata fields: ${invalidFields.join(', ')}` },
        { status: 400 }
      );
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
      return upstreamErrorResponse(response, 'Failed to update account metadata', 'Account metadata update failed');
    }

    const accountData = await response.json();

    if ('is_private' in metadata) {
      try {
        const db = getDb();
        db.prepare('UPDATE monitored_users SET is_public = ? WHERE address = ?')
          .run(metadata.is_private ? 0 : 1, btc_address);
        invalidateRouteCache(['leaderboard:', 'highest-diff:', 'shadow-block:']);
      } catch (dbError) {
        console.error('Failed to sync is_public to local DB:', dbError);
      }
    }

    return NextResponse.json(accountData);
  } catch (error) {
    console.error("Error updating account metadata:", error);
    return NextResponse.json({ error: "Failed to update account metadata" }, { status: 500 });
  }
}
