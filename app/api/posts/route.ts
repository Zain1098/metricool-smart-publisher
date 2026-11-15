import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { PublishMode, SocialPlatform } from '@/lib/types';
import { isSafeMediaUrl, safeErrorMessage } from '@/lib/validation';

const VALID_PLATFORMS = new Set<SocialPlatform>([
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'linkedin',
  'threads',
  'pinterest',
]);

const VALID_PUBLISH_MODES = new Set<PublishMode>([
  'native_schedule',
  'publish_now',
  'local_queue',
]);

export async function GET() {
  await store.ensureSynced();
  const posts = store.getPosts();
  return NextResponse.json({
    success: true,
    posts,
  });
}

export async function POST(req: Request) {
  try {
    await store.ensureSynced();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    if (
      !body.globalCaption &&
      (!body.platformOverrides || Object.keys(body.platformOverrides).length === 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'Caption or platform content is required.' },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.targetPlatforms) ||
      body.targetPlatforms.length === 0 ||
      !body.targetPlatforms.every((p: unknown) => typeof p === 'string' && VALID_PLATFORMS.has(p as SocialPlatform))
    ) {
      return NextResponse.json(
        { success: false, error: 'Select at least one valid social media platform.' },
        { status: 400 }
      );
    }

    if (body.scheduledAt !== undefined) {
      const parsed = new Date(String(body.scheduledAt));
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid scheduledAt date.' },
          { status: 400 }
        );
      }
    }

    if (
      body.publishMode !== undefined &&
      !VALID_PUBLISH_MODES.has(body.publishMode as PublishMode)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid publishMode.' },
        { status: 400 }
      );
    }

    if (
      (body.mediaUrl && !isSafeMediaUrl(String(body.mediaUrl))) ||
      (body.coverUrl && !isSafeMediaUrl(String(body.coverUrl)))
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid mediaUrl or coverUrl.' },
        { status: 400 }
      );
    }

    const publishMode: PublishMode = body.publishMode || 'native_schedule';

    const createdPost = store.addPost({
      userId: body.userId || 'user_1',
      publishMode,
      scheduledAt: body.scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      mediaUrl: body.mediaUrl || '',
      mediaType: body.mediaType || 'video',
      mediaFileName: body.mediaFileName || 'video_clip.mp4',
      mediaDurationSec: body.mediaDurationSec || 30,
      mediaAspectRatio: body.mediaAspectRatio || '9:16',
      mediaSizeMb: body.mediaSizeMb || 12.5,
      coverUrl: body.coverUrl || undefined,
      thumbOffsetMs: typeof body.thumbOffsetMs === 'number' ? body.thumbOffsetMs : 0,
      globalCaption: body.globalCaption || '',
      shortenerEnabled: Boolean(body.shortenerEnabled),
      targetPlatforms: body.targetPlatforms,
      platformOverrides: body.platformOverrides || {},
    });

    // If publishMode is 'publish_now' or 'native_schedule', execute upload to platforms right away!
    // For 'native_schedule', YouTube (status.publishAt) and Facebook (scheduled_publish_time) store
    // the video on their own cloud servers and publish it automatically even when the user's laptop is OFF!
    if (publishMode === 'publish_now' || publishMode === 'native_schedule') {
      const execResult = await store.executePostPublish(createdPost.id, {
        useNativeSchedule: publishMode === 'native_schedule',
      });
      return NextResponse.json({
        success: true,
        post: execResult.post || createdPost,
        publishedUrls: execResult.publishedUrls,
        errors: execResult.errors,
      });
    }

    return NextResponse.json({
      success: true,
      post: createdPost,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Unknown server error') },
      { status: 500 }
    );
  }
}
