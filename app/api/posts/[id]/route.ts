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

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  await store.ensureSynced();
  const { id } = params;
  const post = store.getPosts().find((p) => p.id === id);
  if (!post) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, post });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await store.ensureSynced();
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const useNativeSchedule = Boolean(body?.useNativeSchedule);
    const result = await store.executePostPublish(id, { useNativeSchedule });
    if (!result.post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    const updatedPost = result.post;
    return NextResponse.json({
      success: updatedPost.status !== 'failed',
      post: updatedPost,
      publishedUrls: result.publishedUrls,
      errors: result.errors,
      message:
        updatedPost.status === 'published'
          ? 'Post published live successfully!'
          : updatedPost.status === 'scheduled_on_platform'
            ? 'Post uploaded & scheduled on platform servers!'
            : 'Publish attempt completed with errors.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await store.ensureSynced();
  const { id } = params;
  const deleted = store.deletePost(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: 'Post deleted successfully' });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await store.ensureSynced();
    const { id } = params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (
      (body.mediaUrl && !isSafeMediaUrl(String(body.mediaUrl))) ||
      (body.coverUrl && !isSafeMediaUrl(String(body.coverUrl)))
    ) {
      return NextResponse.json({ success: false, error: 'Invalid mediaUrl or coverUrl' }, { status: 400 });
    }

    if (body.scheduledAt !== undefined) {
      const parsed = new Date(String(body.scheduledAt));
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid scheduledAt date' }, { status: 400 });
      }
    }

    if (
      body.targetPlatforms !== undefined &&
      (!Array.isArray(body.targetPlatforms) ||
        body.targetPlatforms.length === 0 ||
        !body.targetPlatforms.every((p) => typeof p === 'string' && VALID_PLATFORMS.has(p as SocialPlatform)))
    ) {
      return NextResponse.json({ success: false, error: 'Invalid targetPlatforms' }, { status: 400 });
    }

    if (
      body.publishMode !== undefined &&
      (typeof body.publishMode !== 'string' || !VALID_PUBLISH_MODES.has(body.publishMode as PublishMode))
    ) {
      return NextResponse.json({ success: false, error: 'Invalid publishMode' }, { status: 400 });
    }

    const allowedPatch: Record<string, unknown> = {};
    const allowedKeys = [
      'globalCaption',
      'scheduledAt',
      'targetPlatforms',
      'platformOverrides',
      'shortenerEnabled',
      'publishMode',
      'mediaUrl',
      'mediaFileName',
      'mediaDurationSec',
      'mediaAspectRatio',
      'mediaSizeMb',
      'coverUrl',
      'thumbOffsetMs',
    ];
    for (const key of allowedKeys) {
      if (key in body) {
        allowedPatch[key] = body[key];
      }
    }

    const updated = store.updatePost(id, allowedPatch);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, post: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Unknown server error') },
      { status: 500 }
    );
  }
}
