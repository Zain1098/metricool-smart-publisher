import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { PublishMode } from '@/lib/types';

export async function GET() {
  const posts = store.getPosts();
  return NextResponse.json({
    success: true,
    posts,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (
      !body.globalCaption &&
      (!body.platformOverrides || Object.keys(body.platformOverrides).length === 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'Caption or platform content is required.' },
        { status: 400 }
      );
    }

    if (!body.targetPlatforms || body.targetPlatforms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Select at least one social media platform.' },
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
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
