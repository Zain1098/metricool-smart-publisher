import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const PUBLIC_PAGE_PATHS = new Set([
  '/login',
  '/privacy',
  '/terms',
  '/terms-and-conditions',
  '/terms-of-service',
  '/tos',
  '/privacy-policy',
]);

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/cron',
  '/api/webhooks/postiz',
  '/api/mcp',
  '/.well-known/',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Basic per-IP rate limiting on API mutations
  if (pathname.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD') {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`api:${ip}:${pathname}`, 60, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }
  }

  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(sessionToken);

  if (!authenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
