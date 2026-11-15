import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getSessionCookieOptions,
  isAdminAuthConfigured,
  verifyAdminCredentials,
} from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    configured: isAdminAuthConfigured(),
  });
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        }
      );
    }

    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'ADMIN_PASSWORD is not configured in server environment variables.',
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required.' },
        { status: 400 }
      );
    }

    const valid = await verifyAdminCredentials(body.password, body.email);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    const token = await createSessionToken(body.email || 'admin');
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Failed to create session.' },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set({
      ...getSessionCookieOptions(),
      value: token,
    });
    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Login failed.' },
      { status: 500 }
    );
  }
}
