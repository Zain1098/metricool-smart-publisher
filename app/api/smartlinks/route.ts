import { NextRequest, NextResponse } from 'next/server';
import {
  createSmartLinkProfile,
  deleteSmartLinkProfile,
  getSmartLinkBySlug,
  listSmartLinks,
  updateSmartLinkProfile,
} from '@/lib/smartlinks-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (slug) {
    const profile = getSmartLinkBySlug(slug);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'SmartLink not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, profile });
  }
  return NextResponse.json({ success: true, profiles: listSmartLinks() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile = createSmartLinkProfile({
      slug: body?.slug || 'my-links',
      title: body?.title || 'My Links',
      bio: body?.bio,
      accentColor: body?.accentColor,
    });
    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }
    const updated = updateSmartLinkProfile(body.id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, profile: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  const ok = deleteSmartLinkProfile(id);
  return NextResponse.json({ success: ok });
}
