import { ConnectedAccount, ScheduledPost, SocialPlatform } from './types';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface PlatformPublishResult {
  platform: SocialPlatform;
  success: boolean;
  remoteUrl?: string;
  remoteStatus?: 'PUBLISHED' | 'SCHEDULED_ON_PLATFORM';
  error?: string;
  mode: 'live_api';
}

const GRAPH_API_VERSION = 'v22.0';

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
  options?: { useNativeSchedule?: boolean }
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
  const creds = account.credentials;
  const hasRealToken = Boolean(creds?.accessToken && creds.accessToken.trim().length > 5);
  const useNativeSchedule = Boolean(options?.useNativeSchedule);

  if (!hasRealToken || !creds?.accessToken) {
    return {
      platform,
      success: false,
      error: `${account.accountName || platform} does not have an active API token configured.`,
      mode: 'live_api',
    };
  }

  if (
    (creds.accessToken === 'VAULT_MANAGED_YOUTUBE_OAUTH' && platform === 'youtube') ||
    (creds.accessToken === 'VAULT_MANAGED_META_TOKEN' &&
      (platform === 'facebook' || platform === 'instagram'))
  ) {
    return await runVaultPublisher(platform, effectivePost, useNativeSchedule);
  }

  try {
    switch (platform) {
      case 'instagram': {
        const igUserId = creds.accountId;
        if (!igUserId) {
          throw new Error('Missing Instagram Business Account ID (ig_user_id)');
        }
        const payload: Record<string, unknown> = {
          media_type: override?.postType === 'story' ? 'STORIES' : 'REELS',
          video_url: post.mediaUrl.startsWith('http')
            ? post.mediaUrl
            : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${post.mediaUrl}`,
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
        const creationId = containerData.id;

        const pubRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(igUserId)}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creation_id: creationId,
              access_token: creds.accessToken,
            }),
          }
        );
        const pubData = await pubRes.json();
        if (pubData.error) {
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
        const pageId = creds.accountId;
        if (!pageId) {
          throw new Error('Missing Facebook Page ID (page_id)');
        }
        const schedUnix = Math.floor(new Date(post.scheduledAt).getTime() / 1000);
        const canNativeSchedule =
          useNativeSchedule && schedUnix > Math.floor(Date.now() / 1000) + 600;

        const fbBody: Record<string, unknown> = {
          file_url: post.mediaUrl.startsWith('http')
            ? post.mediaUrl
            : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${post.mediaUrl}`,
          title: title.slice(0, 100),
          description:
            override?.isCreatedWithAi || override?.isAiGenerated
              ? `${caption}\n\n[AI Info: Created or edited with AI]`.trim()
              : caption,
          published: !canNativeSchedule,
          embeddable: override?.embeddable !== false,
          secret: Boolean(override?.secret),
          access_token: creds.accessToken,
        };
        if (canNativeSchedule) {
          fbBody.scheduled_publish_time = schedUnix;
        }

        const fbRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/videos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbBody),
          }
        );
        const fbData = await fbRes.json();
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
              video_url: post.mediaUrl.startsWith('http')
                ? post.mediaUrl
                : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${post.mediaUrl}`,
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
        const thPubRes = await fetch(
          `https://graph.threads.net/v1.0/${encodeURIComponent(threadsUserId)}/threads_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creation_id: thContainer.id,
              access_token: creds.accessToken,
            }),
          }
        );
        const thPub = await thPubRes.json();
        if (thPub.error) {
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
        const privacyMap: Record<string, string> = {
          public: 'PUBLIC_TO_EVERYONE',
          friends: 'MUTUAL_FOLLOW_FRIENDS',
          private: 'SELF_ONLY',
          unlisted: 'SELF_ONLY',
        };
        const ttRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            post_info: {
              title: caption.slice(0, 2200),
              privacy_level: privacyMap[override?.privacy || 'public'] || 'PUBLIC_TO_EVERYONE',
              disable_duet: override?.allowDuet === false,
              disable_stitch: override?.allowStitch === false,
              disable_comment: override?.allowComments === false,
              video_cover_timestamp_ms: override?.thumbOffsetMs ?? post.thumbOffsetMs ?? 1000,
              brand_content_toggle: Boolean(
                override?.commercialContent && override?.commercialBrandedContent
              ),
              brand_organic_toggle: Boolean(
                override?.commercialContent && override?.commercialYourBrand !== false
              ),
              is_aigc: Boolean(override?.isAiGenerated || override?.isCreatedWithAi),
              is_ai_generated: Boolean(override?.isAiGenerated || override?.isCreatedWithAi),
              auto_add_music: Boolean(override?.autoAddMusic),
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: post.mediaUrl.startsWith('http')
                ? post.mediaUrl
                : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${post.mediaUrl}`,
            },
          }),
        });
        const ttData = await ttRes.json();
        if (ttData.error && ttData.error.code !== 'ok') {
          throw new Error(ttData.error.message || 'TikTok API error');
        }
        const pubId = ttData?.data?.publish_id || post.id;
        return {
          platform,
          success: true,
          remoteUrl: `https://www.tiktok.com/${account.handle}/video/${pubId}`,
          remoteStatus: 'PUBLISHED',
          mode: 'live_api',
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
        const xRes = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(xPayload),
        });
        const xData = await xRes.json();
        if (!xRes.ok || xData.errors) {
          throw new Error(xData.detail || xData.errors?.[0]?.message || 'X API v2 error');
        }
        if (override?.firstComment?.trim() && xData.data?.id) {
          await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
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
        if (creds.accessToken === 'VAULT_MANAGED_YOUTUBE_OAUTH') {
          return await runVaultPublisher('youtube', effectivePost, useNativeSchedule);
        }

        const localVideoPath = resolveLocalUploadFile(post.mediaUrl);
        if (!localVideoPath || !fs.existsSync(localVideoPath)) {
          throw new Error(`Video file not found on server for YouTube upload: ${post.mediaUrl}`);
        }

        const videoBytes = fs.readFileSync(localVideoPath);
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
          body: videoBytes,
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
        const localThumbPath = resolveLocalUploadFile(coverUrl);
        if (localThumbPath && fs.existsSync(localThumbPath)) {
          const thumbBytes = fs.readFileSync(localThumbPath);
          await fetch(
            `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${creds.accessToken}`,
                'Content-Type': localThumbPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
              },
              body: thumbBytes,
            }
          ).catch(() => {});
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
