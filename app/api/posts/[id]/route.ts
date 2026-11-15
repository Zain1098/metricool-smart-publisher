import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { isSafeMediaUrl, safeErrorMessage } from '@/lib/validation';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const { id } = params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.coverUrl && !isSafeMediaUrl(String(body.coverUrl))) {
      return NextResponse.json({ success: false, error: 'Invalid coverUrl' }, { status: 400 });
    }

    const allowedPatch: Record<string, unknown> = {};
    const allowedKeys = [
      'globalCaption',
      'scheduledAt',
      'targetPlatforms',
      'platformOverrides',
      'shortenerEnabled',
      'publishMode',
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
