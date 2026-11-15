import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { PlatformCredentials, SocialPlatform } from '@/lib/types';
import { verifyAndDiscoverPlatformToken } from '@/lib/account-discovery';

export const dynamic = 'force-dynamic';

export async function GET() {
  const accounts = store.getAccounts();
  return NextResponse.json({ success: true, accounts });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      platform?: SocialPlatform;
      connect?: boolean;
      accountName?: string;
      handle?: string;
      avatarUrl?: string;
      followersCount?: number;
      authMode?: 'oauth' | 'api_key';
      appId?: string;
      appSecret?: string;
      credentials?: PlatformCredentials;
    };

    if (!body.platform) {
      return NextResponse.json(
        { success: false, error: 'Platform is required' },
        { status: 400 }
      );
    }

    if (!body.connect) {
      const disconnected = store.toggleAccountConnection(body.platform, false);
      return NextResponse.json({
        success: true,
        account: disconnected,
        accounts: store.getAccounts(),
      });
    }

    const rawToken = body.credentials?.accessToken?.trim() || '';
    const manualAccountId = body.credentials?.accountId?.trim() || '';
    const manualName = body.accountName?.trim() || '';
    const manualHandle = body.handle?.trim() || '';

    if (!rawToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please paste a valid OAuth / API Access Token.',
        },
        { status: 400 }
      );
    }

    // Automatically verify token & auto-discover account ID, name, handle, avatar & followers!
    const discovery = await verifyAndDiscoverPlatformToken(
      body.platform,
      rawToken,
      manualAccountId || undefined,
      manualName || undefined,
      manualHandle || undefined,
      body.appId,
      body.appSecret
    );

    if (!discovery.valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            discovery.error ||
            `Could not verify ${body.platform} token. Please check the token and permissions.`,
        },
        { status: 400 }
      );
    }

    const updated = store.toggleAccountConnection(body.platform, true, {
      accountName: discovery.accountName,
      handle: discovery.handle,
      avatarUrl: discovery.avatarUrl || body.avatarUrl,
      followersCount: discovery.followersCount ?? body.followersCount ?? 0,
      postsCount: discovery.postsCount,
      viewsCount: discovery.viewsCount,
      authMode: body.authMode || 'api_key',
      tokenStatus: 'valid',
      tokenStatusNote: discovery.statusNote,
      credentials: {
        accountId: discovery.accountId,
        accessToken: rawToken,
        refreshToken: body.credentials?.refreshToken,
        clientId: body.credentials?.clientId,
        clientSecret: body.credentials?.clientSecret,
      },
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${discovery.accountName} (${discovery.handle}) connected & verified!`,
      account: updated,
      accounts: store.getAccounts(),
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
