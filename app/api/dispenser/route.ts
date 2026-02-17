import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export async function GET() {
  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error fetching eligibility: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch eligibility" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/eligibility`, {
      headers,
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch eligibility" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching eligibility:", error);
    return NextResponse.json({ error: "Failed to fetch eligibility" }, { status: 500 });
  }
}
