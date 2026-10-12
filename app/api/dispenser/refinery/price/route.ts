import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

// Current hash price (sats per PHd) used to express auction bids as work.
export async function GET() {
  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error fetching refinery price: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch refinery price" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/refinery/price`, {
      headers,
      next: { revalidate: 60 },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching refinery price:", error);
    return NextResponse.json({ error: "Failed to fetch refinery price" }, { status: 500 });
  }
}
