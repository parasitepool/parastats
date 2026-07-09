import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export async function GET() {
  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error fetching tiers: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch tiers" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/tiers`, {
      headers,
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch tiers" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    return NextResponse.json({ error: "Failed to fetch tiers" }, { status: 500 });
  }
}
