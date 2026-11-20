import { NextRequest, NextResponse } from 'next/server';
import {
  addCompetitorProfile,
  addTrackedHashtag,
  listCompetitorsData,
  removeCompetitorProfile,
  removeTrackedHashtag,
} from '@/lib/competitors-store';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

async function getYouTubeAccessToken(): Promise<string | null> {
  const acc = store.getRawAccount('youtube');
  const clientId = acc?.credentials?.clientId || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = acc?.credentials?.clientSecret || process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = acc?.credentials?.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
  let accessToken = acc?.credentials?.accessToken || process.env.YOUTUBE_ACCESS_TOKEN;

  if (refreshToken && clientId && clientSecret) {
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
      const json = await res.json();
      if (json?.access_token) accessToken = json.access_token;
    } catch {
      // ignore
    }
  }
  return accessToken && !accessToken.startsWith('VAULT_MANAGED') ? accessToken : null;
}

export async function GET() {
  return NextResponse.json({ success: true, ...listCompetitorsData() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.kind === 'hashtag') {
      const rawTag = String(body.tag || '').trim().replace(/^#/, '');
      if (!rawTag) {
        return NextResponse.json({ success: false, error: 'Hashtag is required' }, { status: 400 });
      }

      let matchingVideos = 0;
      let sampleTitles: string[] = [];
      const token = await getYouTubeAccessToken();
      const apiKey = process.env.YOUTUBE_API_KEY;

      if (token || apiKey) {
        const authQuery = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        try {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent('#' + rawTag)}${authQuery}`,
            { headers }
          );
          if (ytRes.ok) {
            const ytJson = await ytRes.json();
            matchingVideos = ytJson?.pageInfo?.totalResults || ytJson?.items?.length || 0;
            sampleTitles = (ytJson?.items || []).map((i: any) => i.snippet?.title).filter(Boolean);
          }
        } catch {
          // fallback below
        }
      }

      const item = addTrackedHashtag({
        tag: `#${rawTag}`,
        matchingVideos,
        sampleTitles,
        lastCheckedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, hashtag: item }, { status: 201 });
    }

    // Competitor lookup
    const handle = String(body?.handle || '').trim();
    const platform = (body?.platform || 'youtube') as 'youtube' | 'instagram' | 'tiktok';
    if (!handle) {
      return NextResponse.json({ success: false, error: 'Handle is required' }, { status: 400 });
    }

    let name = body?.name || handle;
    let followers = Number(body?.followers || 0);
    let totalViews = Number(body?.totalViews || 0);
    let postsCount = Number(body?.postsCount || 0);
    let source: 'live_api' | 'manual' = 'manual';

    if (platform === 'youtube') {
      const token = await getYouTubeAccessToken();
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (token || apiKey) {
        const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
        const authQuery = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        try {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(cleanHandle)}${authQuery}`,
            { headers }
          );
          if (ytRes.ok) {
            const ytJson = await ytRes.json();
            const ch = ytJson?.items?.[0];
            if (ch?.statistics) {
              name = ch.snippet?.title || name;
              followers = Number(ch.statistics.subscriberCount || 0);
              totalViews = Number(ch.statistics.viewCount || 0);
              postsCount = Number(ch.statistics.videoCount || 0);
              source = 'live_api';
            }
          }
        } catch {
          // fallback to manual values
        }
      }
    }

    const competitor = addCompetitorProfile({
      platform,
      handle,
      name,
      followers,
      totalViews,
      postsCount,
      avgEngagementPct: Number(body?.avgEngagementPct || 0),
      lastSyncedAt: new Date().toISOString(),
      source,
    });

    return NextResponse.json({ success: true, competitor }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') || 'competitor';
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ success: false }, { status: 400 });
  if (kind === 'hashtag') removeTrackedHashtag(id);
  else removeCompetitorProfile(id);
  return NextResponse.json({ success: true });
}
