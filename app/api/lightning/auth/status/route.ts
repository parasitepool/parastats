import { NextResponse } from 'next/server';
import { rateLimitResponse } from '@/app/api/lib/rate-limit';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import { readLightningToken } from '@/lib/lightning-session';

export async function GET(request: Request) {
  const limited = rateLimitResponse(request, 60, 'lightning-status');
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawAddress = searchParams.get('address');

  if (!rawAddress) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const normalizedAddress = normalizeBitcoinAddress(rawAddress);
  if (!isValidBitcoinAddress(normalizedAddress)) {
    return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
  }

  const authenticated = readLightningToken(request, normalizedAddress) !== null;
  return NextResponse.json(
    { authenticated },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
