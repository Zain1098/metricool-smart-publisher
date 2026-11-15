import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

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
    const body = await req.json();
    const updated = store.updatePost(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, post: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
