import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { isR2Configured, getR2BucketName } from '@/lib/r2';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isPostizConfigured } from '@/lib/postiz';
import { PublishMode } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_PUBLISH_MODES = new Set<PublishMode>([
  'native_schedule',
  'publish_now',
  'local_queue',
]);

export async function GET() {
  await store.ensureSynced();
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
      mcpConfigured: Boolean(process.env.MCP_API_KEY && process.env.MCP_API_KEY.length >= 16),
    },
  });
}

export async function POST(req: Request) {
  try {
    await store.ensureSynced();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};

    if (typeof body.brandName === 'string') {
      const trimmed = body.brandName.trim();
      if (trimmed.length === 0 || trimmed.length > 80) {
        return NextResponse.json(
          { success: false, error: 'Brand name must be between 1 and 80 characters.' },
          { status: 400 }
        );
      }
      patch.brandName = trimmed;
    }

    if (typeof body.timezone === 'string') {
      const tz = body.timezone.trim();
      if (tz.length === 0 || tz.length > 64) {
        return NextResponse.json(
          { success: false, error: 'Invalid timezone.' },
          { status: 400 }
        );
      }
      patch.timezone = tz;
    }

    if (typeof body.notificationEmail === 'string') {
      const email = body.notificationEmail.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Invalid notification email address.' },
          { status: 400 }
        );
      }
      patch.notificationEmail = email;
    }

    if (typeof body.autoOptimalTime === 'boolean') {
      patch.autoOptimalTime = body.autoOptimalTime;
    }

    if (body.defaultPublishMode !== undefined) {
      if (
        typeof body.defaultPublishMode !== 'string' ||
        !VALID_PUBLISH_MODES.has(body.defaultPublishMode as PublishMode)
      ) {
        return NextResponse.json(
          { success: false, error: 'Invalid defaultPublishMode.' },
          { status: 400 }
        );
      }
      patch.defaultPublishMode = body.defaultPublishMode;
    }

    const updated = store.updateSettings(patch);
    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
