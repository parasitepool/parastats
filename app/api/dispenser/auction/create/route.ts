import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export async function POST(request: Request) {
  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error("Error creating auction: No DISPENSER_API_URL defined in env");
      return NextResponse.json({ error: "Failed to create auction" }, { status: 500 });
    }

    const body = await request.json();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/auction/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating auction:", error);
    return NextResponse.json({ error: "Failed to create auction" }, { status: 500 });
  }
}
