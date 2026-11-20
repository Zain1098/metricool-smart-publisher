import { store } from '@/lib/store';
import { readJsonStore, writeJsonStore } from '@/lib/json-store';
import type { SocialPlatform } from '@/lib/types';

const GRAPH_VERSION = 'v22.0';
const LIVE_POSTS_FILE = 'live-posts-analytics.json';

export interface LivePostMetric {
  id: string;
  platform: SocialPlatform;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;
  privacyStatus: string;
  url: string;
  engagementRate: number;
}

export function loadCrossPlatformLivePosts(): LivePostMetric[] {
  return readJsonStore<LivePostMetric[]>(LIVE_POSTS_FILE, []);
}

function savePlatformPosts(platform: SocialPlatform, posts: LivePostMetric[]): void {
  const existing = loadCrossPlatformLivePosts().filter((p) => p.platform !== platform);
  writeJsonStore(LIVE_POSTS_FILE, [...posts, ...existing]);
}

function calcEng(views: number, likes: number, comments: number): number {
  const base = views > 0 ? views : likes + comments;
  if (base <= 0) return 0;
  return Number((((likes + comments) / Math.max(views, 1)) * 100).toFixed(2));
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6000
): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshYouTubeLive(): Promise<{
  subscribers?: number;
  views?: number;
  videos?: number;
} | null> {
  const acc = store.getRawAccount('youtube');
  const clientId = acc?.credentials?.clientId || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = acc?.credentials?.clientSecret || process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = acc?.credentials?.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
  let accessToken = acc?.credentials?.accessToken || process.env.YOUTUBE_ACCESS_TOKEN;

  if (refreshToken && clientId && clientSecret) {
    const tokenRes = await fetchJsonWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (tokenRes?.access_token) {
      accessToken = tokenRes.access_token;
    }
  }

  if (!accessToken) return null;

  const ch = await fetchJsonWithTimeout(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const item = ch?.items?.[0];
  if (!item?.statistics) return null;

  const subscribers = Number(item.statistics.subscriberCount || 0);
  const views = Number(item.statistics.viewCount || 0);
  const videos = Number(item.statistics.videoCount || 0);

  store.toggleAccountConnection('youtube', true, {
    accountName: item.snippet?.title || acc?.accountName || 'YouTube',
    handle: item.snippet?.customUrl || acc?.handle,
    followersCount: subscribers,
    viewsCount: views,
    postsCount: videos,
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
    credentials: {
      accountId: item.id || acc?.credentials?.accountId,
      accessToken,
      refreshToken: refreshToken || acc?.credentials?.refreshToken,
      clientId: clientId || acc?.credentials?.clientId,
      clientSecret: clientSecret || acc?.credentials?.clientSecret,
    },
  });

  return { subscribers, views, videos };
}

async function refreshMetaLive(): Promise<void> {
  const fbAcc = store.getRawAccount('facebook');
  const igAcc = store.getRawAccount('instagram');
  const rawToken =
    (fbAcc?.credentials?.accessToken && !fbAcc.credentials.accessToken.startsWith('VAULT_MANAGED')
      ? fbAcc.credentials.accessToken
      : undefined) ||
    (igAcc?.credentials?.accessToken && !igAcc.credentials.accessToken.startsWith('VAULT_MANAGED')
      ? igAcc.credentials.accessToken
      : undefined) ||
    process.env.META_ACCESS_TOKEN;

  if (!rawToken) return;

  const pages = await fetchJsonWithTimeout(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,followers_count,fan_count,instagram_business_account{id,username,followers_count,media_count}&access_token=${encodeURIComponent(rawToken)}`
  );
  let page = pages?.data?.[0];

  if (!page) {
    const knownPageId = fbAcc?.credentials?.accountId || '442234252298250';
    page = await fetchJsonWithTimeout(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(knownPageId)}?fields=id,name,access_token,followers_count,fan_count,instagram_business_account{id,username,followers_count,media_count}&access_token=${encodeURIComponent(rawToken)}`
    );
  }
  if (!page?.id) return;

  const pageToken = String(page.access_token || rawToken);

  store.toggleAccountConnection('facebook', true, {
    accountName: page.name || fbAcc?.accountName,
    followersCount: Number(page.followers_count || page.fan_count || fbAcc?.followersCount || 0),
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
    credentials: {
      accountId: String(page.id),
      accessToken: pageToken,
    },
  });

  if (page.instagram_business_account?.id) {
    const ig = page.instagram_business_account;
    store.toggleAccountConnection('instagram', true, {
      accountName: ig.username ? `@${ig.username}` : igAcc?.accountName,
      handle: ig.username ? `@${ig.username}` : igAcc?.handle,
      followersCount: Number(ig.followers_count || igAcc?.followersCount || 0),
      postsCount: Number(ig.media_count || igAcc?.postsCount || 0),
      tokenStatus: 'valid',
      tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
      credentials: {
        accountId: String(ig.id),
        accessToken: pageToken,
      },
    });

    // Fetch per-post Instagram media metrics
    const igMedia = await fetchJsonWithTimeout(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(ig.id)}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${encodeURIComponent(pageToken)}`
    );
    if (Array.isArray(igMedia?.data)) {
      const igPosts: LivePostMetric[] = igMedia.data.map((m: any) => {
        const likes = Number(m.like_count || 0);
        const comments = Number(m.comments_count || 0);
        return {
          id: String(m.id),
          platform: 'instagram',
          title: String(m.caption || m.media_type || 'Instagram Post').slice(0, 120),
          publishedAt: String(m.timestamp || new Date().toISOString()),
          thumbnailUrl: String(m.thumbnail_url || m.media_url || ''),
          views: likes * 10,
          likes,
          comments,
          duration: m.media_type === 'VIDEO' ? 'Reel' : 'Post',
          privacyStatus: 'public',
          url: String(m.permalink || 'https://www.instagram.com/'),
          engagementRate: calcEng(Math.max(likes * 10, 1), likes, comments),
        };
      });
      savePlatformPosts('instagram', igPosts);
    }
  }

  // Fetch per-post Facebook Page posts
  const fbPostsRes = await fetchJsonWithTimeout(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(page.id)}/posts?fields=id,message,created_time,permalink_url,full_picture,likes.summary(true),comments.summary(true)&limit=25&access_token=${encodeURIComponent(pageToken)}`
  );
  if (Array.isArray(fbPostsRes?.data)) {
    const fbPosts: LivePostMetric[] = fbPostsRes.data.map((p: any) => {
      const likes = Number(p.likes?.summary?.total_count || 0);
      const comments = Number(p.comments?.summary?.total_count || 0);
      return {
        id: String(p.id),
        platform: 'facebook',
        title: String(p.message || 'Facebook Post').slice(0, 120),
        publishedAt: String(p.created_time || new Date().toISOString()),
        thumbnailUrl: String(p.full_picture || ''),
        views: likes * 12,
        likes,
        comments,
        duration: 'Post',
        privacyStatus: 'public',
        url: String(p.permalink_url || 'https://www.facebook.com/'),
        engagementRate: calcEng(Math.max(likes * 12, 1), likes, comments),
      };
    });
    savePlatformPosts('facebook', fbPosts);
  }
}

async function refreshTikTokLive(): Promise<void> {
  const acc = store.getRawAccount('tiktok');
  const token = acc?.credentials?.accessToken || process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) return;

  const res = await fetchJsonWithTimeout(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,likes_count,video_count',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const user = res?.data?.user;
  if (!user) return;

  store.toggleAccountConnection('tiktok', true, {
    accountName: user.display_name || acc?.accountName,
    followersCount: Number(user.follower_count || 0),
    postsCount: Number(user.video_count || 0),
    viewsCount: Number(user.likes_count || acc?.viewsCount || 0),
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
  });

  // Fetch per-video TikTok list
  const vidRes = await fetchJsonWithTimeout(
    'https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,duration,like_count,comment_count,view_count',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: 20 }),
    }
  );
  if (Array.isArray(vidRes?.data?.videos)) {
    const tkPosts: LivePostMetric[] = vidRes.data.videos.map((v: any) => {
      const views = Number(v.view_count || 0);
      const likes = Number(v.like_count || 0);
      const comments = Number(v.comment_count || 0);
      return {
        id: String(v.id),
        platform: 'tiktok',
        title: String(v.title || 'TikTok Video').slice(0, 120),
        publishedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : new Date().toISOString(),
        thumbnailUrl: String(v.cover_image_url || ''),
        views,
        likes,
        comments,
        duration: v.duration ? `${v.duration}s` : 'Video',
        privacyStatus: 'public',
        url: String(v.share_url || 'https://www.tiktok.com/'),
        engagementRate: calcEng(views, likes, comments),
      };
    });
    savePlatformPosts('tiktok', tkPosts);
  }
}

async function refreshTwitterLive(): Promise<void> {
  const acc = store.getRawAccount('twitter');
  let token =
    acc?.credentials?.accessToken || process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN;
  let refreshToken = acc?.credentials?.refreshToken || process.env.X_REFRESH_TOKEN;
  const clientId = acc?.credentials?.clientId || process.env.X_CLIENT_ID;
  const clientSecret = acc?.credentials?.clientSecret || process.env.X_CLIENT_SECRET;

  if (!token && !refreshToken) return;

  let res = token
    ? await fetchJsonWithTimeout(
        'https://api.twitter.com/2/users/me?user.fields=public_metrics,name,username',
        { headers: { Authorization: `Bearer ${token}` } }
      )
    : null;

  if (!res?.data && refreshToken && clientId) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64'
      )}`;
    }
    const tokenRes = await fetchJsonWithTimeout('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: clientId,
      }).toString(),
    });
    if (tokenRes?.access_token) {
      token = String(tokenRes.access_token);
      if (tokenRes.refresh_token) {
        refreshToken = String(tokenRes.refresh_token);
      }
      res = await fetchJsonWithTimeout(
        'https://api.twitter.com/2/users/me?user.fields=public_metrics,name,username',
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
  }

  const u = res?.data;
  if (!u?.public_metrics) return;

  store.toggleAccountConnection('twitter', true, {
    accountName: u.name || acc?.accountName,
    handle: u.username ? `@${u.username}` : acc?.handle,
    followersCount: Number(u.public_metrics.followers_count || 0),
    postsCount: Number(u.public_metrics.tweet_count || 0),
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
    credentials: {
      accountId: String(u.id || acc?.credentials?.accountId || ''),
      accessToken: token,
      refreshToken,
      clientId,
      clientSecret,
    },
  });

  if (u.id && token) {
    const tweetsRes = await fetchJsonWithTimeout(
      `https://api.twitter.com/2/users/${encodeURIComponent(u.id)}/tweets?max_results=20&tweet.fields=created_at,public_metrics`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (Array.isArray(tweetsRes?.data)) {
      const xPosts: LivePostMetric[] = tweetsRes.data.map((t: any) => {
        const views = Number(t.public_metrics?.impression_count || 0);
        const likes = Number(t.public_metrics?.like_count || 0);
        const comments = Number(t.public_metrics?.reply_count || 0);
        return {
          id: String(t.id),
          platform: 'twitter',
          title: String(t.text || 'X Post').slice(0, 120),
          publishedAt: String(t.created_at || new Date().toISOString()),
          thumbnailUrl: '',
          views,
          likes,
          comments,
          duration: 'Post',
          privacyStatus: 'public',
          url: `https://x.com/${u.username || 'i'}/status/${t.id}`,
          engagementRate: calcEng(views, likes, comments),
        };
      });
      savePlatformPosts('twitter', xPosts);
    }
  }
}

async function refreshThreadsLive(): Promise<void> {
  const acc = store.getRawAccount('threads');
  const token = acc?.credentials?.accessToken || process.env.THREADS_ACCESS_TOKEN;
  if (!token) return;

  const res = await fetchJsonWithTimeout(
    `https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${encodeURIComponent(token)}`
  );
  if (!res?.id) return;

  store.toggleAccountConnection('threads', true, {
    accountName: res.name || acc?.accountName,
    handle: res.username ? `@${res.username}` : acc?.handle,
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
  });

  const threadsRes = await fetchJsonWithTimeout(
    `https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,permalink,media_type&limit=20&access_token=${encodeURIComponent(token)}`
  );
  if (Array.isArray(threadsRes?.data)) {
    const tPosts: LivePostMetric[] = threadsRes.data.map((t: any) => ({
      id: String(t.id),
      platform: 'threads',
      title: String(t.text || 'Threads Post').slice(0, 120),
      publishedAt: String(t.timestamp || new Date().toISOString()),
      thumbnailUrl: '',
      views: 0,
      likes: 0,
      comments: 0,
      duration: String(t.media_type || 'Post'),
      privacyStatus: 'public',
      url: String(t.permalink || 'https://www.threads.net/'),
      engagementRate: 0,
    }));
    savePlatformPosts('threads', tPosts);
  }
}

async function refreshLinkedInLive(): Promise<void> {
  const acc = store.getRawAccount('linkedin');
  const token = acc?.credentials?.accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) return;

  const res = await fetchJsonWithTimeout('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res?.sub) return;

  store.toggleAccountConnection('linkedin', true, {
    accountName: res.name || acc?.accountName || 'LinkedIn',
    handle: res.email || acc?.handle,
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
    credentials: {
      accountId: String(res.sub),
      accessToken: token,
    },
  });
}

async function refreshPinterestLive(): Promise<void> {
  const acc = store.getRawAccount('pinterest');
  const token = acc?.credentials?.accessToken || process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) return;

  const res = await fetchJsonWithTimeout('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res?.username) return;

  store.toggleAccountConnection('pinterest', true, {
    accountName: res.business_name || res.username || acc?.accountName,
    handle: `@${res.username}`,
    followersCount: Number(res.follower_count || acc?.followersCount || 0),
    postsCount: Number(res.pin_count || acc?.postsCount || 0),
    viewsCount: Number(res.monthly_views || acc?.viewsCount || 0),
    tokenStatus: 'valid',
    tokenStatusNote: `Live synced ${new Date().toLocaleTimeString()}`,
  });

  const pinsRes = await fetchJsonWithTimeout('https://api.pinterest.com/v5/pins?page_size=20', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (Array.isArray(pinsRes?.items)) {
    const pinPosts: LivePostMetric[] = pinsRes.items.map((p: any) => ({
      id: String(p.id),
      platform: 'pinterest',
      title: String(p.title || p.description || 'Pinterest Pin').slice(0, 120),
      publishedAt: String(p.created_at || new Date().toISOString()),
      thumbnailUrl: String(p.media?.images?.['400x300']?.url || ''),
      views: Number(p.pin_metrics?.lifetime_metrics?.impression || 0),
      likes: Number(p.pin_metrics?.lifetime_metrics?.save || 0),
      comments: 0,
      duration: 'Pin',
      privacyStatus: 'public',
      url: `https://www.pinterest.com/pin/${p.id}/`,
      engagementRate: 0,
    }));
    savePlatformPosts('pinterest', pinPosts);
  }
}

export async function refreshAllConnectedPlatformsLive(): Promise<{
  youtubeLive: { subscribers?: number; views?: number; videos?: number } | null;
  syncedAt: string;
}> {
  const [ytRes] = await Promise.allSettled([
    refreshYouTubeLive(),
    refreshMetaLive(),
    refreshTikTokLive(),
    refreshTwitterLive(),
    refreshThreadsLive(),
    refreshLinkedInLive(),
    refreshPinterestLive(),
  ]);

  return {
    youtubeLive: ytRes.status === 'fulfilled' ? ytRes.value : null,
    syncedAt: new Date().toISOString(),
  };
}
