import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error fetching user eligibility: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch user eligibility" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(
      `${apiUrl}/eligibility/${encodeURIComponent(username)}`,
      {
        headers,
        next: { revalidate: 10 },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to fetch user eligibility" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching user eligibility:", error);
    return NextResponse.json({ error: "Failed to fetch user eligibility" }, { status: 500 });
  }
}
