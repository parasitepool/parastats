import { NextResponse } from 'next/server';
import { fetch } from '@/lib/http-client';
import { cachedJson } from '@/lib/route-cache';

interface DispenserFetchOptions {
  path: string;
  cacheKey: string;
  ttlSeconds: number;
  errorMessage: string;
  passThroughErrorBody?: boolean;
}

interface DispenserResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function proxyDispenserGet(options: DispenserFetchOptions): Promise<NextResponse> {
  const {
    path,
    cacheKey,
    ttlSeconds,
    errorMessage,
    passThroughErrorBody = false,
  } = options;

  try {
    const apiUrl = process.env.DISPENSER_API_URL;
    if (!apiUrl) {
      console.error(`${errorMessage}: No DISPENSER_API_URL defined in env`);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const result = await cachedJson<DispenserResult>(
      cacheKey,
      ttlSeconds * 1000,
      async () => {
        const response = await fetch(`${apiUrl}${path}`, { headers });
        if (!response.ok) {
          const body = passThroughErrorBody && response.status < 500
            ? await response.json().catch(() => ({ error: errorMessage }))
            : { error: errorMessage };
          return { ok: false, status: response.status, body };
        }
        return { ok: true, status: response.status, body: await response.json() };
      },
      entry => entry.ok,
    );

    if (!result.ok) {
      return NextResponse.json(result.body, {
        status: result.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json(result.body, {
      headers: {
        'Cache-Control': `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
      },
    });
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
