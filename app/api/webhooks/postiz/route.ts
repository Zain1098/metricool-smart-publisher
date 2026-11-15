import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { recordAuditLog, recordPublishingJob, upsertPostInSupabase } from '@/lib/supabase';
import { timingSafeEqualStrings } from '@/lib/auth';
import { safeErrorMessage } from '@/lib/validation';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifyWebhookSecret(req: Request, rawBody: string): boolean {
  const secret = process.env.POSTIZ_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const signature = req.headers.get('x-postiz-signature') || req.headers.get('x-signature');
  if (signature) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  const authHeader = req.headers.get('authorization') || '';
  return timingSafeEqualStrings(authHeader, `Bearer ${secret}`);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    if (!verifyWebhookSecret(req, rawBody)) {
      return NextResponse.json({ success: false, error: 'Invalid webhook signature or secret' }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload' }, { status: 400 });
    }

    const event = (payload.event || payload.type || 'post.updated') as string;
    const postizPostId = (payload.postId || payload.id || (payload.data as Record<string, unknown>)?.id) as string;

    if (!postizPostId) {
      return NextResponse.json({ success: true, message: 'Webhook ignored: missing postizPostId' });
    }

    // Match local post by postizPostId
    const allPosts = store.getPosts();
    const targetPost = allPosts.find((p) => p.postizPostId === postizPostId);

    if (!targetPost) {
      return NextResponse.json({ success: true, message: 'No local post matched postizPostId' });
    }

    const status = ((payload.status || (payload.data as Record<string, unknown>)?.status || '') as string).toUpperCase();
    const remoteUrl = ((payload.url || (payload.data as Record<string, unknown>)?.url || '') as string);
    const error = ((payload.error || (payload.data as Record<string, unknown>)?.error || '') as string);

    if (status === 'PUBLISHED' || event === 'post.published') {
      targetPost.status = 'published';
      targetPost.publishedAt = new Date().toISOString();
      if (remoteUrl) {
        for (const p of targetPost.targetPlatforms) {
          targetPost.publishedUrls = targetPost.publishedUrls || {};
          targetPost.publishedUrls[p] = remoteUrl;
        }
      }
    } else if (status === 'ERROR' || status === 'FAILED' || event === 'post.failed') {
      targetPost.status = 'failed';
      targetPost.errorMessage = error || 'Postiz publishing encountered an error';
    }

    store.updatePost(targetPost.id, {
      status: targetPost.status,
      publishedAt: targetPost.publishedAt,
      publishedUrls: targetPost.publishedUrls,
      errorMessage: targetPost.errorMessage,
    });

    await upsertPostInSupabase(targetPost).catch(() => {});
    await recordAuditLog({
      action: `POSTIZ_WEBHOOK_${event.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`,
      entityType: 'post',
      entityId: targetPost.id,
      metadata: { postizPostId, status, event },
    });

    return NextResponse.json({
      success: true,
      message: 'Postiz webhook processed successfully',
      postId: targetPost.id,
      status: targetPost.status,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Webhook handler error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
