import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Silence Chrome DevTools probe:
  // GET /.well-known/appspecific/com.chrome.devtools.json
  if (pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
    // Option A: return empty JSON (200)
    return new NextResponse('{}', {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

    // Option B: return no content (204) — also fine:
    // return new NextResponse(null, { status: 204 });
  }

  return NextResponse.next();
}

// Only run this middleware for that one path
export const config = {
  matcher: '/.well-known/appspecific/com.chrome.devtools.json',
};
