import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error fetching auction bids: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch auction bids" }, { status: 500 });
    }

    const { id } = await params;

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/auction/${encodeURIComponent(id)}/bids`, {
      headers,
      next: { revalidate: 5 },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching auction bids:", error);
    return NextResponse.json({ error: "Failed to fetch auction bids" }, { status: 500 });
  }
}
