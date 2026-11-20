import { NextRequest, NextResponse } from 'next/server';
import { getSmartLinkBySlug, recordSmartLinkClick } from '@/lib/smartlinks-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || '';
  const profile = getSmartLinkBySlug(slug);
  if (!profile) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, profile });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = recordSmartLinkClick(String(body?.slug || ''), body?.linkId);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, profile: updated });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
