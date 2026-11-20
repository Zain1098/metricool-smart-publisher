import { NextRequest, NextResponse } from 'next/server';
import { clearPixelEvents, getPixelStats } from '@/lib/pixel-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get('site') || 'all';
  return NextResponse.json({ success: true, ...getPixelStats(site) });
}

export async function DELETE() {
  clearPixelEvents();
  return NextResponse.json({ success: true });
}
