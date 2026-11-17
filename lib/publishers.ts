import { ConnectedAccount, PlatformCredentials, ScheduledPost, SocialPlatform } from './types';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName, getR2PublicBaseUrl } from './r2';

export interface PlatformPublishResult {
  platform: SocialPlatform;
  success: boolean;
  remoteUrl?: string;
  remoteStatus?: 'PUBLISHED' | 'SCHEDULED_ON_PLATFORM';
  error?: string;
  mode: 'live_api';
}

const GRAPH_API_VERSION = 'v22.0';

const mediaBufferCache = new Map<string, Promise<Buffer>>();
const r2PublicUrlCache = new Map<string, Promise<string>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      (process.cwd() && process.cwd().startsWith('/var/task'))
  );
}

function hasLocalVaultAvailable(): boolean {
  if (isServerlessRuntime()) return false;
  const rootDir = process.cwd();
  const legacyDir = path.join(rootDir, 'legacy-python');
  const vaultFile = path.join(legacyDir, 'data', 'credentials.json');
  return fs.existsSync(legacyDir) && fs.existsSync(vaultFile);
}

function resolveLocalUploadFile(urlStr: string): string {
  if (!urlStr) return '';
  const rootDir = process.cwd();
  let baseName = '';
  if (urlStr.startsWith('/uploads/')) {
    baseName = path.basename(urlStr);
  } else if (urlStr.startsWith('/api/upload?file=')) {
    const fileParam = decodeURIComponent(urlStr.replace('/api/upload?file=', ''));
    baseName = path.basename(fileParam);
  }
  if (!baseName) return '';

  const publicPath = path.join(rootDir, 'public', 'uploads', baseName);
  if (fs.existsSync(publicPath)) return publicPath;

  const tmpPath = path.join(os.tmpdir(), 'metricool-uploads', baseName);
  if (fs.existsSync(tmpPath)) return tmpPath;

  return publicPath;
}

async function loadMediaBytes(urlOrPath: string): Promise<Buffer> {
  if (!urlOrPath) {
    throw new Error('No media URL or file path provided.');
  }

  const localPath = resolveLocalUploadFile(urlOrPath);
  if (localPath && fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  const fullUrl = urlOrPath.startsWith('http')
    ? urlOrPath
    : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${urlOrPath}`;

  let pending = mediaBufferCache.get(fullUrl);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(fullUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch media from ${fullUrl} (HTTP ${res.status})`);
      }
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    })();
    mediaBufferCache.set(fullUrl, pending);
    pending.finally(() => {
      setTimeout(() => mediaBufferCache.delete(fullUrl), 60000);
    });
  }
  return pending;
}

async function ensurePublicMediaUrl(urlOrPath: string, fileName?: string): Promise<string> {
  if (
    urlOrPath.startsWith('https://') &&
    !urlOrPath.includes('localhost') &&
    !urlOrPath.includes('127.0.0.1') &&
    !urlOrPath.includes('/api/upload?file=')
  ) {
    return urlOrPath;
  }

  let pending = r2PublicUrlCache.get(urlOrPath);
  if (!pending) {
    pending = (async () => {
      const s3 = getR2Client();
      const publicBase = getR2PublicBaseUrl();
      if (s3 && publicBase) {
        const videoBytes = await loadMediaBytes(urlOrPath);
        const safeName = (fileName || path.basename(urlOrPath) || 'video.mp4').replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );
        const finalName = safeName.endsWith('.mp4') ? safeName : `${safeName}.mp4`;
        const storageKey = `videos/original/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}_${finalName}`;
        await s3.send(
          new PutObjectCommand({
            Bucket: getR2BucketName(),
            Key: storageKey,
            Body: videoBytes,
            ContentType: 'video/mp4',
            ContentLength: videoBytes.byteLength,
          })
        );
        return `${publicBase}/${storageKey}`;
      }
      return urlOrPath.startsWith('http')
        ? urlOrPath
        : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${urlOrPath}`;
    })();
    r2PublicUrlCache.set(urlOrPath, pending);
    pending.finally(() => {
      setTimeout(() => r2PublicUrlCache.delete(urlOrPath), 300000);
    });
  }
  return pending;
}

async function refreshYouTubeAccessToken(creds?: PlatformCredentials): Promise<string | null> {
  const clientId =
    creds?.clientId || process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    creds?.clientSecret || process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = creds?.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      return String(data.access_token);
    }
  } catch {
    // ignore
  }
  return null;
}

async function resolveMetaTokenAndAccount(
  platform: 'facebook' | 'instagram',
  creds?: PlatformCredentials
): Promise<{ accessToken: string; accountId: string } | null> {
  const rawToken =
    creds?.accessToken && !creds.accessToken.startsWith('VAULT_MANAGED')
      ? creds.accessToken
      : process.env.META_ACCESS_TOKEN || '';

  const fallbackPageId =
    platform === 'facebook' ? creds?.accountId || '442234252298250' : '442234252298250';
  const fallbackIgId = creds?.accountId || '17841448708660067';

  if (!rawToken) return null;

  try {
    // Query the page directly to get the Page Access Token & linked Instagram Business Account
    const pageRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
        fallbackPageId
      )}?fields=id,access_token,instagram_business_account{id}&access_token=${encodeURIComponent(
        rawToken
      )}`
    );
    const pageData = await pageRes.json();
    if (!pageData.error && pageData.id) {
      const pageToken = String(pageData.access_token || rawToken);
      if (platform === 'facebook') {
        return { accessToken: pageToken, accountId: String(pageData.id) };
      }
      const igId = String(pageData.instagram_business_account?.id || fallbackIgId);
      return { accessToken: pageToken, accountId: igId };
    }
  } catch {
    // fall through
  }

  return {
    accessToken: rawToken,
    accountId: platform === 'facebook' ? fallbackPageId : fallbackIgId,
  };
}

async function refreshTwitterAccessToken(
  creds?: PlatformCredentials
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const clientId = creds?.clientId || process.env.X_CLIENT_ID;
  const clientSecret = creds?.clientSecret || process.env.X_CLIENT_SECRET;
  const refreshToken = creds?.refreshToken || process.env.X_REFRESH_TOKEN;

  if (!clientId || !refreshToken) return null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64'
      )}`;
    }
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: clientId,
      }).toString(),
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      return {
        accessToken: String(data.access_token),
        refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function refreshTikTokAccessToken(
  creds?: PlatformCredentials
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const clientKey = creds?.clientId || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = creds?.clientSecret || process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = creds?.refreshToken || process.env.TIKTOK_REFRESH_TOKEN;

  if (!clientKey || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      return {
        accessToken: String(data.access_token),
        refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function shortenUrlsInText(text: string): Promise<string> {
  if (!text) return text;
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const matches = text.match(urlRegex);
  if (!matches || matches.length === 0) return text;

  let updated = text;
  const uniqueUrls = Array.from(new Set(matches));
  for (const rawUrl of uniqueUrls) {
    if (
      rawUrl.includes('tinyurl.com/') ||
      rawUrl.includes('is.gd/') ||
      rawUrl.includes('bit.ly/')
    ) {
      continue;
    }
    try {
      const res = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(rawUrl)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const shortUrl = (await res.text()).trim();
        if (shortUrl.startsWith('http')) {
          updated = updated.split(rawUrl).join(shortUrl);
        }
      }
    } catch {
      // Safe fallback: keep original URL if shortener service times out
    }
  }
  return updated;
}

function runVaultPublisher(
  platform: 'youtube' | 'facebook' | 'instagram',
  post: ScheduledPost,
  useNativeSchedule: boolean
): Promise<PlatformPublishResult> {
  return new Promise((resolve) => {
    // 1. Guard against serverless execution (Netlify / Vercel / AWS Lambda)
    const isServerless = Boolean(
      process.env.NETLIFY ||
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        (process.cwd() && process.cwd().startsWith('/var/task'))
    );

    if (isServerless) {
      resolve({
        platform,
        success: false,
        error:
          'Local Python vault execution is not supported in cloud serverless hosting. Configure standard API tokens or the Postiz publishing adapter.',
        mode: 'live_api',
      });
      return;
    }

    const rootDir = process.cwd();
    const legacyDir = path.join(rootDir, 'legacy-python');
    if (!fs.existsSync(legacyDir)) {
      resolve({
        platform,
        success: false,
        error: 'Legacy Python adapter directory not found on host.',
        mode: 'live_api',
      });
      return;
    }

    // 2. Cross-platform Python detection (Windows + Linux/macOS safe)
    const isWin = process.platform === 'win32';
    const venvPython = isWin
      ? path.join(rootDir, '.venv', 'Scripts', 'python.exe')
      : path.join(rootDir, '.venv', 'bin', 'python');

    let pythonExe: string | null = null;
    if (fs.existsSync(venvPython)) {
      pythonExe = venvPython;
    } else {
      // Check system python fallback safely
      pythonExe = isWin ? 'python' : 'python3';
    }

    const localVideoPath = resolveLocalUploadFile(post.mediaUrl);

    const override = post.platformOverrides?.[platform];
    const coverUrl = override?.coverUrl || post.coverUrl || '';
    const localThumbnailPath = resolveLocalUploadFile(coverUrl);

    const schedTimeMs = new Date(post.scheduledAt).getTime();
    const isFuture = schedTimeMs > Date.now() + 2 * 60 * 1000;
    const isFutureTenMins = schedTimeMs > Date.now() + 10 * 60 * 1000;

    const jobPayload = {
      job_uid: post.id,
      video_path: localVideoPath,
      thumbnail_path: localThumbnailPath,
      thumb_offset_ms: override?.thumbOffsetMs ?? post.thumbOffsetMs ?? 0,
      title: override?.title || post.globalCaption?.slice(0, 80) || post.mediaFileName,
      caption: override?.caption || post.globalCaption || '',
      privacy: override?.privacy || 'public',
      first_comment: override?.firstComment || '',
      publish_at:
        useNativeSchedule && platform === 'youtube' && isFuture
          ? new Date(schedTimeMs).toISOString()
          : undefined,
      scheduled_unix:
        useNativeSchedule && platform === 'facebook' && isFutureTenMins
          ? Math.floor(schedTimeMs / 1000)
          : undefined,
      platform_settings: {
        youtube: {
          category_id: override?.categoryId || '28',
          made_for_kids: Boolean(override?.madeForKids),
          license: override?.license || 'youtube',
          embeddable: override?.embeddable !== false,
          notify_subscribers: override?.notifySubscribers !== false,
          public_stats_viewable: override?.publicStatsViewable !== false,
          contains_synthetic_media: Boolean(
            override?.containsSyntheticMedia || override?.isAiGenerated
          ),
          paid_promotion: Boolean(override?.paidPromotion),
          sponsor_handle: override?.sponsorHandle || '',
          default_language: override?.defaultLanguage || 'en',
          playlist_id: override?.playlistId || '',
          is_short:
            override?.isShortOrReel !== false && override?.postType !== 'video',
          tags: override?.tags || [],
          first_comment: override?.firstComment || '',
        },
        instagram: {
          share_to_feed: override?.shareToFeed !== false,
          is_created_with_ai: Boolean(
            override?.isCreatedWithAi || override?.isAiGenerated
          ),
          audio_name: override?.audioName || '',
          collaborators: override?.collaborators || '',
          user_tags: override?.userTags || '',
          location_name: override?.locationName || '',
          paid_promotion: Boolean(override?.paidPromotion),
          sponsor_handle: override?.sponsorHandle || '',
          first_comment: override?.firstComment || '',
        },
        facebook: {
          share_to_feed: override?.shareToFeed !== false,
          is_created_with_ai: Boolean(
            override?.isCreatedWithAi || override?.isAiGenerated
          ),
          embeddable: override?.embeddable !== false,
          secret: Boolean(override?.secret),
          paid_promotion: Boolean(override?.paidPromotion),
          sponsor_handle: override?.sponsorHandle || '',
          call_to_action_type: override?.callToActionType || 'NONE',
          destination_link: override?.destinationLink || '',
          first_comment: override?.firstComment || '',
        },
      },
    };

    const pyCode = `
import json
from src.security import CredentialManager
from src.platforms.${platform} import ${
      platform === 'youtube'
        ? 'YouTubeAdapter'
        : platform === 'facebook'
        ? 'FacebookAdapter'
        : 'InstagramAdapter'
    } as Adapter

cm = CredentialManager()
creds = cm.get_credentials(${JSON.stringify(platform)}) or {}
adapter = Adapter()
job = ${JSON.stringify(jobPayload)}
if job.get("video_path"):
    res = adapter.upload(job, creds)
    print("JSON_OUT:" + json.dumps({
        "success": res.success,
        "status": res.status,
        "remote_url": res.remote_url,
        "error": res.error_message
    }))
else:
    print("JSON_OUT:" + json.dumps({
        "success": False,
        "error": "Please upload a real video file from your computer first."
    }))
`;

    execFile(pythonExe, ['-c', pyCode], { cwd: legacyDir, timeout: 240000 }, (err, stdout, stderr) => {
      const match = (stdout || '').match(/JSON_OUT:(\{.*\})/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          resolve({
            platform,
            success: Boolean(parsed.success),
            remoteUrl: parsed.remote_url,
            remoteStatus:
              parsed.status === 'SCHEDULED_ON_PLATFORM' ? 'SCHEDULED_ON_PLATFORM' : 'PUBLISHED',
            error: parsed.error,
            mode: 'live_api',
          });
          return;
        } catch {
          // ignore parse error
        }
      }
      resolve({
        platform,
        success: false,
        error: stderr || (err ? err.message : 'Vault publish error'),
        mode: 'live_api',
      });
    });
  });
}

export async function publishToPlatform(
  post: ScheduledPost,
  account: ConnectedAccount | undefined,
  options?: {
    useNativeSchedule?: boolean;
    onCredentialsRefreshed?: (platform: SocialPlatform, updated: Partial<PlatformCredentials>) => void;
  }
): Promise<PlatformPublishResult> {
  const platform = account?.platform;
  if (!account || !account.isConnected || !platform) {
    return {
      platform: (platform || 'youtube') as SocialPlatform,
      success: false,
      error: 'Platform account is not connected.',
      mode: 'live_api',
    };
  }

  const override = post.platformOverrides?.[platform];
  let caption = override?.caption || post.globalCaption || '';
  if (post.shortenerEnabled && caption.includes('http')) {
    caption = await shortenUrlsInText(caption);
  }
  const effectivePost: ScheduledPost =
    post.shortenerEnabled && caption !== (override?.caption || post.globalCaption || '')
      ? {
          ...post,
          globalCaption: caption,
          platformOverrides: {
            ...post.platformOverrides,
            [platform]: {
              ...override,
              caption,
            },
          },
        }
      : post;

  const title = override?.title || caption.slice(0, 80) || post.mediaFileName;
  const creds: PlatformCredentials = { ...(account.credentials || {}) };
  const useNativeSchedule = Boolean(options?.useNativeSchedule);

  // If local Python vault is requested AND actually present on local disk, allow it
  if (
    hasLocalVaultAvailable() &&
    ((creds.accessToken === 'VAULT_MANAGED_YOUTUBE_OAUTH' && platform === 'youtube') ||
      (creds.accessToken === 'VAULT_MANAGED_META_TOKEN' &&
        (platform === 'facebook' || platform === 'instagram')))
  ) {
    return await runVaultPublisher(platform, effectivePost, useNativeSchedule);
  }

  // Resolve and auto-refresh platform tokens for cloud & direct API execution
  if (platform === 'youtube') {
    const refreshedYtToken = await refreshYouTubeAccessToken(creds);
    if (refreshedYtToken) {
      creds.accessToken = refreshedYtToken;
      options?.onCredentialsRefreshed?.('youtube', { accessToken: refreshedYtToken });
    } else if (
      !creds.accessToken ||
      creds.accessToken === 'VAULT_MANAGED_YOUTUBE_OAUTH'
    ) {
      creds.accessToken = process.env.YOUTUBE_ACCESS_TOKEN || '';
    }
  } else if (platform === 'facebook' || platform === 'instagram') {
    const metaResolved = await resolveMetaTokenAndAccount(platform, creds);
    if (metaResolved) {
      creds.accessToken = metaResolved.accessToken;
      creds.accountId = metaResolved.accountId;
      options?.onCredentialsRefreshed?.(platform, {
        accessToken: metaResolved.accessToken,
        accountId: metaResolved.accountId,
      });
    }
  } else if (platform === 'threads') {
    if (!creds.accessToken || creds.accessToken.startsWith('VAULT_MANAGED')) {
      creds.accessToken = process.env.THREADS_ACCESS_TOKEN || '';
    }
    if (!creds.accountId) {
      creds.accountId = 'me';
    }
  } else if (platform === 'tiktok') {
    if (!creds.accessToken || creds.accessToken.startsWith('VAULT_MANAGED')) {
      creds.accessToken = process.env.TIKTOK_ACCESS_TOKEN || '';
    }
    if (!creds.accessToken && (creds.refreshToken || process.env.TIKTOK_REFRESH_TOKEN)) {
      const ttRef = await refreshTikTokAccessToken(creds);
      if (ttRef) {
        creds.accessToken = ttRef.accessToken;
        creds.refreshToken = ttRef.refreshToken;
        options?.onCredentialsRefreshed?.('tiktok', ttRef);
      }
    }
  } else if (platform === 'twitter') {
    if (!creds.accessToken || creds.accessToken.startsWith('VAULT_MANAGED')) {
      creds.accessToken = process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN || '';
    }
    if (!creds.accessToken && (creds.refreshToken || process.env.X_REFRESH_TOKEN)) {
      const xRef = await refreshTwitterAccessToken(creds);
      if (xRef) {
        creds.accessToken = xRef.accessToken;
        creds.refreshToken = xRef.refreshToken;
        options?.onCredentialsRefreshed?.('twitter', xRef);
      }
    }
  }

  const hasRealToken = Boolean(
    creds?.accessToken &&
      creds.accessToken.trim().length > 5 &&
      !creds.accessToken.startsWith('VAULT_MANAGED')
  );

  if (!hasRealToken || !creds?.accessToken) {
    return {
      platform,
      success: false,
      error: `${account.accountName || platform} does not have an active API token configured.`,
      mode: 'live_api',
    };
  }

  try {
    switch (platform) {
      case 'instagram': {
        const igUserId = creds.accountId || '17841448708660067';
        if (!igUserId) {
          throw new Error('Missing Instagram Business Account ID (ig_user_id)');
        }
        const publicVideoUrl = await ensurePublicMediaUrl(post.mediaUrl, post.mediaFileName);
        const payload: Record<string, unknown> = {
          media_type: override?.postType === 'story' ? 'STORIES' : 'REELS',
          video_url: publicVideoUrl,
          caption: caption.slice(0, 2200),
          share_to_feed: override?.shareToFeed !== false,
          access_token: creds.accessToken,
        };
        if (override?.thumbOffsetMs !== undefined || post.thumbOffsetMs !== undefined) {
          payload.thumb_offset = override?.thumbOffsetMs ?? post.thumbOffsetMs ?? 0;
        }
        if (override?.isCreatedWithAi || override?.isAiGenerated) {
          payload.is_created_with_ai = true;
        }
        if (override?.audioName) {
          payload.audio_name = override.audioName;
        }
        if (override?.collaborators) {
          const collabs = override.collaborators
            .split(',')
            .map((c) => c.trim().replace(/^@/, ''))
            .filter(Boolean)
            .slice(0, 3);
          if (collabs.length > 0) {
            payload.collaborators = collabs;
          }
        }
        if (override?.userTags) {
          const ut = override.userTags
            .split(',')
            .map((u) => u.trim().replace(/^@/, ''))
            .filter(Boolean)
            .slice(0, 5)
            .map((username) => ({ username, x: 0.5, y: 0.5 }));
          if (ut.length > 0) {
            payload.user_tags = ut;
          }
        }
        const containerRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(igUserId)}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        const containerData = await containerRes.json();
        if (containerData.error) {
          throw new Error(containerData.error.message || 'Instagram container error');
        }
        const creationId = String(containerData.id);

        // Poll Instagram container status until video transcoding is FINISHED
        let igStatus = 'IN_PROGRESS';
        for (let attempt = 0; attempt < 30; attempt++) {
          await sleep(3000);
          const statusRes = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
              creationId
            )}?fields=status_code,status&access_token=${encodeURIComponent(creds.accessToken)}`
          );
          const statusData = await statusRes.json();
          igStatus = String(statusData.status_code || 'IN_PROGRESS');
          if (igStatus === 'FINISHED' || igStatus === 'READY' || igStatus === 'PUBLISHED') {
            break;
          }
          if (igStatus === 'ERROR' || igStatus === 'EXPIRED') {
            throw new Error(
              statusData.status || `Instagram video processing failed (${igStatus})`
            );
          }
        }

        let pubData: any = null;
        for (let pubAttempt = 0; pubAttempt < 3; pubAttempt++) {
          const pubRes = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
              igUserId
            )}/media_publish`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creation_id: creationId,
                access_token: creds.accessToken,
              }),
            }
          );
          pubData = await pubRes.json();
          if (!pubData.error) break;
          if (pubAttempt < 2) {
            await sleep(3000);
          }
        }
        if (pubData?.error) {
          throw new Error(pubData.error.message || 'Instagram publish error');
        }

        if (override?.firstComment?.trim() && pubData.id) {
          await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pubData.id)}/comments`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: override.firstComment.trim(),
                access_token: creds.accessToken,
              }),
            }
          ).catch(() => {});
        }

        return {
          platform,
          success: true,
          remoteUrl: `https://www.instagram.com/reel/${pubData.id}/`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
        };
      }

      case 'facebook': {
        const pageId = creds.accountId || '442234252298250';
        if (!pageId) {
          throw new Error('Missing Facebook Page ID (page_id)');
        }
        const schedUnix = Math.floor(new Date(post.scheduledAt).getTime() / 1000);
        const canNativeSchedule =
          useNativeSchedule && schedUnix > Math.floor(Date.now() / 1000) + 600;

        const publicVideoUrl = await ensurePublicMediaUrl(post.mediaUrl, post.mediaFileName);
        const fbDescription =
          override?.isCreatedWithAi || override?.isAiGenerated
            ? `${caption}\n\n[AI Info: Created or edited with AI]`.trim()
            : caption;

        const fbBody: Record<string, unknown> = {
          file_url: publicVideoUrl,
          title: title.slice(0, 100),
          description: fbDescription,
          published: !canNativeSchedule,
          embeddable: override?.embeddable !== false,
          secret: Boolean(override?.secret),
          access_token: creds.accessToken,
        };
        if (canNativeSchedule) {
          fbBody.scheduled_publish_time = schedUnix;
        }

        let fbRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/videos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbBody),
          }
        );
        let fbData = await fbRes.json();

        // Fallback: Direct binary multipart upload if Facebook could not fetch file_url
        if (fbData.error) {
          const videoBytes = await loadMediaBytes(post.mediaUrl);
          const form = new FormData();
          form.append(
            'source',
            new Blob([new Uint8Array(videoBytes)], { type: 'video/mp4' }),
            post.mediaFileName || 'video.mp4'
          );
          form.append('title', title.slice(0, 100));
          form.append('description', fbDescription);
          form.append('published', String(!canNativeSchedule));
          form.append('access_token', creds.accessToken);
          if (canNativeSchedule) {
            form.append('scheduled_publish_time', String(schedUnix));
          }
          fbRes = await fetch(
            `https://graph-video.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
              pageId
            )}/videos`,
            {
              method: 'POST',
              body: form,
            }
          );
          fbData = await fbRes.json();
        }

        if (fbData.error) {
          throw new Error(fbData.error.message || 'Facebook video publish error');
        }

        if (override?.firstComment?.trim() && fbData.id && !canNativeSchedule) {
          await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(fbData.id)}/comments`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: override.firstComment.trim(),
                access_token: creds.accessToken,
              }),
            }
          ).catch(() => {});
        }
        return {
          platform,
          success: true,
          remoteUrl: `https://www.facebook.com/watch/?v=${fbData.id}`,
          remoteStatus: canNativeSchedule ? 'SCHEDULED_ON_PLATFORM' : 'PUBLISHED',
          mode: 'live_api',
        };
      }

      case 'threads': {
        const threadsUserId = creds.accountId || 'me';
        const publicVideoUrl = await ensurePublicMediaUrl(post.mediaUrl, post.mediaFileName);
        const thText =
          override?.isAiGenerated || override?.isCreatedWithAi
            ? `${caption.slice(0, 465)}\n\n#AIGenerated`
            : caption.slice(0, 500);
        const thContainerRes = await fetch(
          `https://graph.threads.net/v1.0/${encodeURIComponent(threadsUserId)}/threads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              media_type: 'VIDEO',
              video_url: publicVideoUrl,
              text: thText,
              reply_control: override?.replyControl || 'everyone',
              topic_tag: override?.topicTag || undefined,
              access_token: creds.accessToken,
            }),
          }
        );
        const thContainer = await thContainerRes.json();
        if (thContainer.error) {
          throw new Error(thContainer.error.message || 'Threads container error');
        }
        const creationId = String(thContainer.id);

        // Poll Threads video container status until status === 'FINISHED'
        let thStatus = 'IN_PROGRESS';
        for (let attempt = 0; attempt < 30; attempt++) {
          await sleep(3000);
          const statusRes = await fetch(
            `https://graph.threads.net/v1.0/${encodeURIComponent(
              creationId
            )}?fields=status,error_message&access_token=${encodeURIComponent(creds.accessToken)}`
          );
          const statusData = await statusRes.json();
          thStatus = String(statusData.status || 'IN_PROGRESS');
          if (thStatus === 'FINISHED' || thStatus === 'PUBLISHED') {
            break;
          }
          if (thStatus === 'ERROR' || thStatus === 'EXPIRED') {
            throw new Error(
              statusData.error_message || `Threads video processing failed (${thStatus})`
            );
          }
        }

        let thPub: any = null;
        for (let pubAttempt = 0; pubAttempt < 3; pubAttempt++) {
          const thPubRes = await fetch(
            `https://graph.threads.net/v1.0/${encodeURIComponent(threadsUserId)}/threads_publish`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creation_id: creationId,
                access_token: creds.accessToken,
              }),
            }
          );
          thPub = await thPubRes.json();
          if (!thPub.error) break;
          if (pubAttempt < 2) {
            await sleep(3000);
          }
        }
        if (thPub?.error) {
          throw new Error(thPub.error.message || 'Threads publish error');
        }
        return {
          platform,
          success: true,
          remoteUrl: `https://www.threads.net/${account.handle}/post/${thPub.id}`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
        };
      }

      case 'tiktok': {
        const videoBytes = await loadMediaBytes(post.mediaUrl);
        const fileSize = videoBytes.byteLength;
        const maxSingleChunk = 64 * 1024 * 1024;
        const chunkSize = fileSize <= maxSingleChunk ? fileSize : 10 * 1024 * 1024;
        const totalChunkCount =
          fileSize <= maxSingleChunk ? 1 : Math.max(1, Math.floor(fileSize / chunkSize));

        const privacyMap: Record<string, string> = {
          public: 'PUBLIC_TO_EVERYONE',
          friends: 'MUTUAL_FOLLOW_FRIENDS',
          private: 'SELF_ONLY',
          unlisted: 'SELF_ONLY',
        };
        const desiredPrivacy = privacyMap[override?.privacy || 'public'] || 'PUBLIC_TO_EVERYONE';

        const buildInitPayload = (privacyLevel: string, allowBrandToggle: boolean) => ({
          post_info: {
            title: caption.slice(0, 2200),
            privacy_level: privacyLevel,
            disable_duet: override?.allowDuet === false,
            disable_stitch: override?.allowStitch === false,
            disable_comment: override?.allowComments === false,
            video_cover_timestamp_ms: override?.thumbOffsetMs ?? post.thumbOffsetMs ?? 1000,
            brand_content_toggle: allowBrandToggle
              ? Boolean(override?.commercialContent && override?.commercialBrandedContent)
              : false,
            brand_organic_toggle: allowBrandToggle
              ? Boolean(override?.commercialContent && override?.commercialYourBrand !== false)
              : false,
            is_aigc: Boolean(override?.isAiGenerated || override?.isCreatedWithAi),
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: fileSize,
            chunk_size: chunkSize,
            total_chunk_count: totalChunkCount,
          },
        });

        let activeTikTokToken = creds.accessToken;
        let ttRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeTikTokToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(buildInitPayload(desiredPrivacy, true)),
        });
        let ttData = await ttRes.json();

        // Auto-refresh TikTok token if expired
        if (
          (ttRes.status === 401 ||
            ttData?.error?.code === 'access_token_invalid' ||
            String(ttData?.error?.message || '').toLowerCase().includes('access token')) &&
          (creds.refreshToken || process.env.TIKTOK_REFRESH_TOKEN)
        ) {
          const ttRef = await refreshTikTokAccessToken(creds);
          if (ttRef) {
            activeTikTokToken = ttRef.accessToken;
            options?.onCredentialsRefreshed?.('tiktok', ttRef);
            ttRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeTikTokToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
              },
              body: JSON.stringify(buildInitPayload(desiredPrivacy, true)),
            });
            ttData = await ttRes.json();
          }
        }

        // Sandbox / unaudited TikTok client fallback to SELF_ONLY
        const ttErrCode = String(ttData?.error?.code || '').toLowerCase();
        const ttErrMsg = String(ttData?.error?.message || '').toLowerCase();
        const isUnauditedOrPrivacyError =
          ttData?.error &&
          ttData.error.code !== 'ok' &&
          (ttErrCode === 'unaudited_client_can_only_post_to_private_accounts' ||
            ttErrMsg.includes('private') ||
            ttErrCode.includes('privacy') ||
            ttErrMsg.includes('integration guidelines') ||
            ttErrMsg.includes('unaudited'));

        if (isUnauditedOrPrivacyError) {
          ttRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeTikTokToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify(buildInitPayload('SELF_ONLY', false)),
          });
          ttData = await ttRes.json();
        }

        // If direct post is still blocked on an unaudited app, fall back to TikTok Inbox (Draft) upload
        let uploadedToInbox = false;
        if (ttData?.error && ttData.error.code !== 'ok' && isUnauditedOrPrivacyError) {
          const inboxRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeTikTokToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({
              source_info: {
                source: 'FILE_UPLOAD',
                video_size: fileSize,
                chunk_size: chunkSize,
                total_chunk_count: totalChunkCount,
              },
            }),
          });
          const inboxData = await inboxRes.json();
          if (!inboxData?.error || inboxData.error.code === 'ok') {
            ttData = inboxData;
            uploadedToInbox = true;
          }
        }

        if (ttData.error && ttData.error.code !== 'ok') {
          throw new Error(ttData.error.message || `TikTok API error (${ttData.error.code})`);
        }

        const pubId = ttData?.data?.publish_id || post.id;
        const uploadUrl = ttData?.data?.upload_url;
        if (!uploadUrl) {
          throw new Error('TikTok did not return a direct binary upload_url.');
        }

        if (totalChunkCount === 1) {
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
              'Content-Length': String(fileSize),
            },
            body: new Uint8Array(videoBytes),
          });
          if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
            const errTxt = await putRes.text();
            throw new Error(`TikTok binary upload failed (${putRes.status}): ${errTxt}`);
          }
        } else {
          for (let i = 0; i < totalChunkCount; i++) {
            const start = i * chunkSize;
            const end = i === totalChunkCount - 1 ? fileSize : (i + 1) * chunkSize;
            const chunkBuf = videoBytes.subarray(start, end);
            const putRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
                'Content-Length': String(chunkBuf.byteLength),
              },
              body: new Uint8Array(chunkBuf),
            });
            if (!putRes.ok && putRes.status !== 201 && putRes.status !== 206) {
              const errTxt = await putRes.text();
              throw new Error(`TikTok chunk ${i + 1} upload failed (${putRes.status}): ${errTxt}`);
            }
          }
        }

        return {
          platform,
          success: true,
          remoteUrl: `https://www.tiktok.com/${account.handle}/video/${pubId}`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
          ...(uploadedToInbox
            ? { error: 'Uploaded to TikTok Inbox/Drafts (unaudited app fallback).' }
            : {}),
        };
      }

      case 'twitter': {
        const xText =
          override?.isAiGenerated || override?.isCreatedWithAi
            ? `${caption.slice(0, 260)} #AI`
            : caption.slice(0, 280);
        const xPayload: Record<string, unknown> = {
          text: xText,
        };
        if (override?.xReplySettings && override.xReplySettings !== 'everyone') {
          xPayload.reply_settings = override.xReplySettings;
        }

        let activeXToken = creds.accessToken;
        let xRes = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeXToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(xPayload),
        });

        // Auto-refresh X OAuth 2.0 token on 401 Unauthorized
        if (xRes.status === 401) {
          const xRef = await refreshTwitterAccessToken(creds);
          if (xRef) {
            activeXToken = xRef.accessToken;
            options?.onCredentialsRefreshed?.('twitter', xRef);
            xRes = await fetch('https://api.twitter.com/2/tweets', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeXToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(xPayload),
            });
          }
        }

        const xData = await xRes.json();
        if (!xRes.ok || xData.errors) {
          throw new Error(xData.detail || xData.errors?.[0]?.message || 'X API v2 error');
        }
        if (override?.firstComment?.trim() && xData.data?.id) {
          await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeXToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: override.firstComment.trim().slice(0, 280),
              reply: { in_reply_to_tweet_id: xData.data.id },
            }),
          }).catch(() => {});
        }
        return {
          platform,
          success: true,
          remoteUrl: `https://x.com/${account.handle.replace('@', '')}/status/${xData.data?.id || post.id}`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
        };
      }

      case 'linkedin': {
        const authorUrn = creds.accountId?.startsWith('urn:li:')
          ? creds.accountId
          : `urn:li:person:${creds.accountId || 'me'}`;
        const liText =
          override?.isAiGenerated || override?.isCreatedWithAi
            ? `${caption.slice(0, 2940)}\n\n[AI Transparency: Assisted/Generated with AI]`
            : caption.slice(0, 3000);
        const liRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            author: authorUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: liText },
                shareMediaCategory: 'NONE',
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility':
                override?.privacy === 'private' ? 'CONNECTIONS' : 'PUBLIC',
            },
          }),
        });
        const liData = await liRes.json();
        if (!liRes.ok) {
          throw new Error(liData.message || 'LinkedIn API error');
        }
        return {
          platform,
          success: true,
          remoteUrl: `https://www.linkedin.com/feed/update/${liData.id || post.id}`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
        };
      }

      case 'pinterest': {
        const pinRes = await fetch('https://api.pinterest.com/v5/pins', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            board_id: override?.boardId || creds.accountId || 'default_board',
            title: title.slice(0, 100),
            description:
              override?.isAiGenerated || override?.isCreatedWithAi
                ? `${caption.slice(0, 470)} #AIGenerated`
                : caption.slice(0, 500),
            alt_text: override?.altText ? override.altText.slice(0, 500) : undefined,
            link: override?.destinationLink || undefined,
          }),
        });
        const pinData = await pinRes.json();
        if (!pinRes.ok) {
          throw new Error(pinData.message || 'Pinterest API v5 error');
        }
        return {
          platform,
          success: true,
          remoteUrl: `https://www.pinterest.com/pin/${pinData.id || post.id}/`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
        };
      }

      case 'youtube': {
        if (hasLocalVaultAvailable() && creds.accessToken === 'VAULT_MANAGED_YOUTUBE_OAUTH') {
          return await runVaultPublisher('youtube', effectivePost, useNativeSchedule);
        }

        const videoBytes = await loadMediaBytes(post.mediaUrl);
        const schedTimeMs = new Date(post.scheduledAt).getTime();
        const isFutureSchedule = useNativeSchedule && schedTimeMs > Date.now() + 2 * 60 * 1000;
        const rawPrivacy = (override?.privacy || 'public').toLowerCase();
        const privacyStatus = isFutureSchedule
          ? 'private'
          : ['public', 'unlisted', 'private'].includes(rawPrivacy)
            ? rawPrivacy
            : 'public';

        const isShort = (override?.postType || 'short') === 'short';
        let finalTitle = title.slice(0, 100);
        if (isShort && !finalTitle.toLowerCase().includes('#shorts') && finalTitle.length <= 91) {
          finalTitle = `${finalTitle} #Shorts`.trim();
        }

        const rawTags: string[] = Array.isArray(override?.tags)
          ? (override.tags as string[]).map((t) => String(t).trim()).filter(Boolean)
          : [];
        if (isShort && !rawTags.some((t) => t.toLowerCase() === 'shorts')) {
          rawTags.push('Shorts');
        }

        let finalDescription = caption;
        if (
          override?.paidPromotion &&
          override?.sponsorHandle &&
          !finalDescription.includes(override.sponsorHandle)
        ) {
          finalDescription = `${finalDescription}\n\nPaid promotion with ${override.sponsorHandle}`.trim();
        }

        const ytMetadata: Record<string, unknown> = {
          snippet: {
            title: finalTitle,
            description: finalDescription,
            tags: rawTags.slice(0, 35),
            categoryId: String(override?.categoryId || '22'),
            defaultLanguage: override?.defaultLanguage || 'en',
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: Boolean(override?.madeForKids),
            embeddable: override?.embeddable !== false,
            publicStatsViewable: override?.publicStatsViewable !== false,
            containsSyntheticMedia: Boolean(
              override?.containsSyntheticMedia ||
                override?.isAiGenerated ||
                override?.isCreatedWithAi
            ),
            ...(isFutureSchedule ? { publishAt: new Date(schedTimeMs).toISOString() } : {}),
            ...(override?.license === 'creativeCommon' ? { license: 'creativeCommon' } : {}),
          },
        };

        const initRes = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Length': String(videoBytes.byteLength),
              'X-Upload-Content-Type': 'video/mp4',
            },
            body: JSON.stringify(ytMetadata),
          }
        );

        if (!initRes.ok) {
          const errText = await initRes.text();
          throw new Error(`YouTube resumable session init failed (${initRes.status}): ${errText}`);
        }

        const uploadLocation = initRes.headers.get('location');
        if (!uploadLocation) {
          throw new Error('YouTube Data API v3 did not return a resumable upload Location header.');
        }

        const uploadRes = await fetch(uploadLocation, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'video/mp4',
            'Content-Length': String(videoBytes.byteLength),
          },
          body: new Uint8Array(videoBytes),
        });

        const ytData = await uploadRes.json();
        if (!uploadRes.ok || !ytData.id) {
          throw new Error(
            ytData?.error?.message || `YouTube binary upload failed (${uploadRes.status})`
          );
        }

        const videoId = String(ytData.id);

        // Optional custom thumbnail upload
        const coverUrl = override?.coverUrl || post.coverUrl || '';
        if (coverUrl) {
          try {
            const thumbBytes = await loadMediaBytes(coverUrl);
            await fetch(
              `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(
                videoId
              )}`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${creds.accessToken}`,
                  'Content-Type': coverUrl.toLowerCase().endsWith('.png')
                    ? 'image/png'
                    : 'image/jpeg',
                },
                body: new Uint8Array(thumbBytes),
              }
            );
          } catch {
            // ignore optional thumbnail error
          }
        }

        // Optional playlist insertion
        if (override?.playlistId?.trim()) {
          await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippet: {
                playlistId: override.playlistId.trim(),
                resourceId: {
                  kind: 'youtube#video',
                  videoId,
                },
              },
            }),
          }).catch(() => {});
        }

        return {
          platform,
          success: true,
          remoteUrl: isShort
            ? `https://www.youtube.com/shorts/${videoId}`
            : `https://www.youtube.com/watch?v=${videoId}`,
          remoteStatus: isFutureSchedule ? 'SCHEDULED_ON_PLATFORM' : 'PUBLISHED',
          mode: 'live_api',
        };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'API call failed';
    return {
      platform,
      success: false,
      error: msg,
      mode: 'live_api',
    };
  }
}
