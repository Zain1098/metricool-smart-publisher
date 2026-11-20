import { NextRequest, NextResponse } from 'next/server';
import { recordPixelEvent } from '@/lib/pixel-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const event = recordPixelEvent({
      siteId: String(body.siteId || 'default').slice(0, 120),
      sessionId: String(body.sessionId || 'anon').slice(0, 120),
      event: String(body.event || 'pageview').slice(0, 40),
      url: String(body.url || '').slice(0, 500),
      path: String(body.path || '/').slice(0, 300),
      title: String(body.title || '').slice(0, 200),
      referrer: String(body.referrer || '').slice(0, 300),
      screen: String(body.screen || '').slice(0, 40),
      ts: body.ts || new Date().toISOString(),
    });
    return NextResponse.json({ success: true, id: event.id }, { status: 201, headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ success: false }, { status: 400, headers: CORS_HEADERS });
  }
}
