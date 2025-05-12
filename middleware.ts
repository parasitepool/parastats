import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the protocol is HTTP
  if (request.headers.get('x-forwarded-proto') === 'http') {
    // Create the HTTPS URL from the original request
    const httpsUrl = `https://${request.headers.get('host')}${request.nextUrl.pathname}${request.nextUrl.search}`;
    
    // Return a redirect response to the HTTPS URL
    return NextResponse.redirect(httpsUrl, 301);
  }
  
  return NextResponse.next();
}

// Only run the middleware on page routes, not API routes or static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};
