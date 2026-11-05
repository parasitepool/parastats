import { NextRequest, NextResponse } from 'next/server';
import { fetch as retryingFetch, type ExtendedRequestInit } from '@/lib/http-client';
import { routerAuthHeaders } from '@/lib/router-orders';

export interface ProxiedResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function forwardQueryParams(request: NextRequest, names: readonly string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const name of names) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params[name] = value;
  }
  return params;
}

export async function fetchRouterResponse(
  url: string | URL,
  init: ExtendedRequestInit = {},
  forwardedHeaders: readonly string[] = [],
): Promise<ProxiedResponse> {
  const headers = new Headers(routerAuthHeaders());
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));

  // The router may accept an order before a connection failure hides the
  // response. Never replay that non-idempotent request automatically.
  const res = init.method?.toUpperCase() === 'POST'
    ? await globalThis.fetch(url, { ...init, headers })
    : await retryingFetch(url, { ...init, headers });
  const responseHeaders: Record<string, string> = {};
  for (const name of forwardedHeaders) {
    const value = res.headers.get(name);
    if (value) responseHeaders[name] = value;
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return { status: res.status, body: await res.json(), headers: responseHeaders };
  }
  if (contentType.includes('text/plain')) {
    return { status: res.status, body: { error: await res.text() }, headers: responseHeaders };
  }
  throw new Error('Router unavailable');
}

export function fetchRouterStatus(routerBase: string, init: ExtendedRequestInit = {}): Promise<ProxiedResponse> {
  return fetchRouterResponse(`${routerBase}/api/router/status`, init);
}

export function isSuccessfulResponse(response: ProxiedResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

export function routerJsonResponse(result: ProxiedResponse): NextResponse {
  const response = NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.headers.set(name, value);
  }
  return response;
}

export function routerErrorResponse(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
