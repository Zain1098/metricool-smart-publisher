import { SocialPlatform, ScheduledPost } from './types';
import { recordPublishingJob, recordAuditLog } from './supabase';

export interface PostizChannel {
  id: string;
  name: string;
  identifier: string; // e.g. 'youtube', 'instagram', 'tiktok', 'facebook', 'x', 'linkedin'
  platform: SocialPlatform;
  profileName?: string;
  avatarUrl?: string;
  disabled?: boolean;
}

export interface PostizPublishResult {
  success: boolean;
  postizPostId?: string;
  status: 'SCHEDULED' | 'PUBLISHED' | 'DRAFT' | 'ERROR';
  platformResults: Partial<Record<SocialPlatform, { success: boolean; remoteUrl?: string; error?: string }>>;
  error?: string;
}

export function isPostizConfigured(): boolean {
  const url = process.env.POSTIZ_API_URL;
  const key = process.env.POSTIZ_API_KEY;
  return Boolean(url && key && url.startsWith('http') && key.trim().length > 3);
}

export function getPostizBaseUrl(): string {
  return (process.env.POSTIZ_API_URL || 'https://postiz.yourdomain.com/api/v1').replace(/\/$/, '');
}

function getPostizApiKey(): string {
  const key = process.env.POSTIZ_API_KEY;
  if (!key) throw new Error('POSTIZ_API_KEY is not defined in environment variables.');
  return key.trim();
}

// ------------------------------------------------------------------------------
// Channel / Integration Sync
// ------------------------------------------------------------------------------
const PLATFORM_MAP: Record<string, SocialPlatform> = {
  youtube: 'youtube',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  twitter: 'twitter',
  x: 'twitter',
  linkedin: 'linkedin',
  threads: 'threads',
  pinterest: 'pinterest',
};

export async function fetchPostizChannels(): Promise<PostizChannel[]> {
  if (!isPostizConfigured()) return [];

  const baseUrl = getPostizBaseUrl();
  const apiKey = getPostizApiKey();

  try {
    const res = await fetch(`${baseUrl}/integrations`, {
      method: 'GET',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Postiz] Failed to fetch channels (${res.status}): ${errText}`);
      return [];
    }

    const json = await res.json();
    const list = Array.isArray(json) ? json : json.integrations || json.channels || [];

    return list
      .map((item: Record<string, unknown>) => {
        const identifier = String(item.identifier || item.type || item.provider || '').toLowerCase();
        const platform = PLATFORM_MAP[identifier];
        if (!platform) return null;

        return {
          id: String(item.id),
          name: String(item.name || item.title || platform),
          identifier,
          platform,
          profileName: (item.profile || item.username || item.handle) as string | undefined,
          avatarUrl: (item.picture || item.avatarUrl) as string | undefined,
          disabled: Boolean(item.disabled),
        };
      })
      .filter((c: PostizChannel | null): c is PostizChannel => c !== null);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Connection error';
    console.warn('[Postiz] fetchPostizChannels exception:', errorMsg);
    return [];
  }
}

// ------------------------------------------------------------------------------
// Media Upload to Postiz
// ------------------------------------------------------------------------------
export async function uploadMediaToPostiz(
  mediaUrl: string,
  fileName: string
): Promise<{ id: string; path: string } | null> {
  if (!isPostizConfigured()) return null;

  const baseUrl = getPostizBaseUrl();
  const apiKey = getPostizApiKey();

  try {
    let fileBuffer: Buffer | null = null;
    let mimeType = 'video/mp4';

    if (mediaUrl.startsWith('http')) {
      const fetchRes = await fetch(mediaUrl);
      if (!fetchRes.ok) throw new Error(`Could not download media from ${mediaUrl}`);
      const arrayBuf = await fetchRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      mimeType = fetchRes.headers.get('content-type') || 'video/mp4';
    } else {
      // Local path or data url
      return null;
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, fileName);

    const uploadRes = await fetch(`${baseUrl}/media`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
      },
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.warn(`[Postiz] Media upload failed (${uploadRes.status}): ${err}`);
      return null;
    }

    const data = await uploadRes.json();
    return {
      id: data.id || data.fileId,
      path: data.path || data.url,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Media upload exception';
    console.warn('[Postiz] uploadMediaToPostiz error:', errorMsg);
    return null;
  }
}

// ------------------------------------------------------------------------------
// Multi-Platform Publishing & Scheduling via Postiz
// ------------------------------------------------------------------------------
export async function publishViaPostiz(
  post: ScheduledPost,
  channels: PostizChannel[],
  options?: { isDraft?: boolean }
): Promise<PostizPublishResult> {
  if (!isPostizConfigured()) {
    return {
      success: false,
      status: 'ERROR',
      platformResults: {},
      error: 'Postiz API is not configured. Falling back to native platform adapters.',
    };
  }

  const baseUrl = getPostizBaseUrl();
  const apiKey = getPostizApiKey();

  // Match targetPlatforms to Postiz connected channels
  const activeChannels = channels.filter(
    (c) => post.targetPlatforms.includes(c.platform) && !c.disabled
  );

  if (activeChannels.length === 0) {
    return {
      success: false,
      status: 'ERROR',
      platformResults: {},
      error: 'No active Postiz integrations matched for target platforms.',
    };
  }

  // Upload video to Postiz media repository first
  let postizMedia: { id: string; path: string } | null = null;
  if (post.mediaUrl.startsWith('http')) {
    postizMedia = await uploadMediaToPostiz(post.mediaUrl, post.mediaFileName);
  }

  const postsPayload = activeChannels.map((ch) => {
    const override = post.platformOverrides?.[ch.platform];
    const caption = override?.caption || post.globalCaption || '';
    const title = override?.title || post.mediaFileName;

    return {
      integration: { id: ch.id },
      value: [
        {
          content: caption,
          title: ch.platform === 'youtube' || ch.platform === 'facebook' ? title : undefined,
          image: postizMedia ? [{ id: postizMedia.id, path: postizMedia.path }] : [],
        },
      ],
      settings: {
        youtube:
          ch.platform === 'youtube'
            ? {
                title: override?.title || post.mediaFileName,
                privacy: override?.privacy || 'public',
                tags: override?.tags || [],
              }
            : undefined,
        instagram:
          ch.platform === 'instagram'
            ? {
                shareToFeed: override?.shareToFeed !== false,
              }
            : undefined,
      },
    };
  });

  const schedTimeMs = new Date(post.scheduledAt).getTime();
  const isNow = post.publishMode === 'publish_now' || schedTimeMs <= Date.now() + 60 * 1000;

  const requestBody = {
    posts: postsPayload,
    scheduledFor: isNow ? undefined : new Date(schedTimeMs).toISOString(),
    draft: Boolean(options?.isDraft),
  };

  try {
    const res = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || `Postiz returned HTTP ${res.status}`);
    }

    const postizPostId = json.id || json.postId;
    const platformResults: PostizPublishResult['platformResults'] = {};

    for (const ch of activeChannels) {
      platformResults[ch.platform] = {
        success: true,
        remoteUrl: `${baseUrl}/posts/${postizPostId}`,
      };

      await recordPublishingJob({
        postId: post.id,
        platform: ch.platform,
        adapter: 'postiz',
        status: isNow ? 'completed' : 'queued',
        remoteJobId: postizPostId,
        remoteUrl: `${baseUrl}/posts/${postizPostId}`,
      });
    }

    await recordAuditLog({
      action: isNow ? 'POSTIZ_PUBLISHED' : 'POSTIZ_SCHEDULED',
      entityType: 'post',
      entityId: post.id,
      metadata: {
        postizPostId,
        channels: activeChannels.map((c) => c.platform),
      },
    });

    return {
      success: true,
      postizPostId,
      status: isNow ? 'PUBLISHED' : 'SCHEDULED',
      platformResults,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Postiz publish failed';
    return {
      success: false,
      status: 'ERROR',
      platformResults: {},
      error: errorMsg,
    };
  }
}

// ------------------------------------------------------------------------------
// Cancellation & Status Checking
// ------------------------------------------------------------------------------
export async function cancelPostizPost(postizPostId: string): Promise<boolean> {
  if (!isPostizConfigured() || !postizPostId) return false;

  const baseUrl = getPostizBaseUrl();
  const apiKey = getPostizApiKey();

  try {
    const res = await fetch(`${baseUrl}/posts/${encodeURIComponent(postizPostId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: apiKey,
      },
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function getPostizPostStatus(postizPostId: string): Promise<string | null> {
  if (!isPostizConfigured() || !postizPostId) return null;

  const baseUrl = getPostizBaseUrl();
  const apiKey = getPostizApiKey();

  try {
    const res = await fetch(`${baseUrl}/posts/${encodeURIComponent(postizPostId)}`, {
      method: 'GET',
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.status || null;
  } catch {
    return null;
  }
}
