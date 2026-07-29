import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

// Live auctions only (the dispenser filters to open/extended), so a slot that
// appears here is currently biddable.
export async function GET() {
  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error fetching auctions: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch auctions" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/auctions`, {
      headers,
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch auctions" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return NextResponse.json({ error: "Failed to fetch auctions" }, { status: 500 });
  }
}
