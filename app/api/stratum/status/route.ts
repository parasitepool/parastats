import { NextResponse } from 'next/server';
import { getStratumStatus } from '@/lib/stratum-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(getStratumStatus(), {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error reading stratum status:', error);
    return NextResponse.json(
      { error: 'Failed to read stratum status' },
      { status: 500 },
    );
  }
}
