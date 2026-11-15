import { store } from '@/lib/store';

const GRAPH_VERSION = 'v22.0';

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
  ]);

  return {
    youtubeLive: ytRes.status === 'fulfilled' ? ytRes.value : null,
    syncedAt: new Date().toISOString(),
  };
}
