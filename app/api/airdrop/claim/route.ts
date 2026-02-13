import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';

export async function POST(request: Request) {
  try {
    const apiUrl = process.env.AIRDROP_API_URL;
    if (!apiUrl) {
      console.error("Error posting claim: No AIRDROP_API_URL defined in env");
      return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 });
    }

    const body = await request.json();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.AIRDROP_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.AIRDROP_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/claim`, {
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
    console.error("Error posting claim:", error);
    return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 });
  }
}
