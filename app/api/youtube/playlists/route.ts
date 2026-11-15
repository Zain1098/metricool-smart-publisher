import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

async function resolveYouTubeAccessToken(): Promise<{
  accessToken: string | null;
  channelId: string | null;
  error?: string;
}> {
  await store.ensureSynced();
  const ytAccount = store.getRawAccount('youtube');
  const creds = ytAccount?.credentials || {};

  const clientId =
    creds.clientId ||
    process.env.YOUTUBE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    creds.clientSecret ||
    process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = creds.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
  const channelId =
    creds.accountId ||
    process.env.YOUTUBE_CHANNEL_ID ||
    'UCFZg0QShW2TMQv7bMTyW-xQ';

  if (clientId && clientSecret && refreshToken) {
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
        const freshToken = String(data.access_token);
        store.toggleAccountConnection('youtube', true, {
          tokenStatus: 'valid',
          credentials: {
            ...creds,
            accessToken: freshToken,
          },
        });
        return {
          accessToken: freshToken,
          channelId,
        };
      }
    } catch {
      // fallback to stored accessToken below
    }
  }

  const rawAccess =
    creds.accessToken &&
    creds.accessToken !== 'VAULT_MANAGED_YOUTUBE_OAUTH' &&
    !creds.accessToken.includes('••••')
      ? creds.accessToken
      : process.env.YOUTUBE_ACCESS_TOKEN || null;

  if (rawAccess) {
    return { accessToken: rawAccess, channelId };
  }

  return {
    accessToken: null,
    channelId,
    error: 'YouTube OAuth credentials are not configured.',
  };
}

export interface YouTubePlaylistItem {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  privacyStatus: string;
  thumbnailUrl?: string;
}

export async function GET() {
  try {
    const { accessToken, channelId, error } = await resolveYouTubeAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          playlists: [],
          error: error || 'Unable to authenticate with YouTube.',
        },
        { status: 200 }
      );
    }

    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&mine=true&maxResults=50',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    let data = await res.json();

    // Fallback to channelId query if mine=true returned no items or failed
    if (
      (!res.ok || !Array.isArray(data.items) || data.items.length === 0) &&
      channelId
    ) {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&channelId=${encodeURIComponent(
          channelId
        )}&maxResults=50`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      );
      if (chRes.ok) {
        data = await chRes.json();
      }
    }

    if (data?.error) {
      return NextResponse.json(
        {
          success: false,
          playlists: [],
          error: data.error.message || 'YouTube Playlists API error',
        },
        { status: 200 }
      );
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    const playlists: YouTubePlaylistItem[] = items.map((item: any) => ({
      id: String(item.id),
      title: String(item.snippet?.title || 'Untitled Playlist'),
      description: String(item.snippet?.description || ''),
      itemCount: Number(item.contentDetails?.itemCount ?? 0),
      privacyStatus: String(item.status?.privacyStatus || 'public'),
      thumbnailUrl:
        item.snippet?.thumbnails?.default?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        undefined,
    }));

    return NextResponse.json({
      success: true,
      channelId,
      playlists,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Failed to fetch YouTube playlists';
    return NextResponse.json(
      { success: false, playlists: [], error: msg },
      { status: 200 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const privacyStatus = ['public', 'unlisted', 'private'].includes(
      body.privacyStatus
    )
      ? body.privacyStatus
      : 'public';

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Playlist title is required.' },
        { status: 400 }
      );
    }

    const { accessToken, error } = await resolveYouTubeAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: error || 'Unable to authenticate with YouTube.',
        },
        { status: 401 }
      );
    }

    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
          },
          status: {
            privacyStatus,
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok || data.error) {
      return NextResponse.json(
        {
          success: false,
          error: data?.error?.message || 'Failed to create YouTube playlist.',
        },
        { status: res.status || 400 }
      );
    }

    const created: YouTubePlaylistItem = {
      id: String(data.id),
      title: String(data.snippet?.title || title),
      description: String(data.snippet?.description || description),
      itemCount: 0,
      privacyStatus: String(data.status?.privacyStatus || privacyStatus),
      thumbnailUrl: data.snippet?.thumbnails?.default?.url || undefined,
    };

    return NextResponse.json({
      success: true,
      playlist: created,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Failed to create YouTube playlist';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
