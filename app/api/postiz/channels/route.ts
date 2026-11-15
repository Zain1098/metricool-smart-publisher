import { NextResponse } from 'next/server';
import { fetchPostizChannels, isPostizConfigured } from '@/lib/postiz';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configured = isPostizConfigured();
    if (!configured) {
      return NextResponse.json({
        success: true,
        configured: false,
        channels: [],
        message: 'Postiz API is not configured. Configure POSTIZ_API_URL and POSTIZ_API_KEY in environment variables.',
      });
    }

    const channels = await fetchPostizChannels();
    return NextResponse.json({
      success: true,
      configured: true,
      channels,
      count: channels.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error checking Postiz channels';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
