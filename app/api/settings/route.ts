import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { isR2Configured, getR2BucketName } from '@/lib/r2';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isPostizConfigured } from '@/lib/postiz';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = store.getSettings();
  return NextResponse.json({
    success: true,
    settings,
    systemStatus: {
      supabaseConfigured: isSupabaseConfigured(),
      r2Configured: isR2Configured(),
      r2Bucket: isR2Configured() ? getR2BucketName() : null,
      postizConfigured: isPostizConfigured(),
      youtubeEnvConfigured: Boolean(
        process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_REFRESH_TOKEN
      ),
      metaEnvConfigured: Boolean(process.env.META_ACCESS_TOKEN),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const updated = store.updateSettings({
      brandName: body.brandName,
      timezone: body.timezone,
      notificationEmail: body.notificationEmail,
      autoOptimalTime: body.autoOptimalTime,
      defaultPublishMode: body.defaultPublishMode,
    });
    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
