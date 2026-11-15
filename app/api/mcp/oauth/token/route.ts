import { NextResponse } from 'next/server';
import {
  createOAuthTokens,
  verifyAuthorizationCode,
  verifyOAuthRefreshToken,
  verifyPkceS256,
} from '@/lib/mcp-oauth';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  let params: Record<string, string> = {};

  if (contentType.includes('application/json')) {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === 'string') params[k] = v;
    }
  } else {
    const raw = await req.text();
    const sp = new URLSearchParams(raw);
    sp.forEach((v, k) => {
      params[k] = v;
    });
  }

  const grantType = params.grant_type;

  if (grantType === 'refresh_token') {
    const refreshPayload = verifyOAuthRefreshToken(params.refresh_token || '');
    if (!refreshPayload) {
      return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
    }
    const tokens = createOAuthTokens(refreshPayload.clientId, refreshPayload.sub);
    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: 'studio:read studio:write',
      },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
    );
  }

  if (grantType !== 'authorization_code') {
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const codePayload = verifyAuthorizationCode(params.code || '');
  if (!codePayload) {
    return NextResponse.json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code.' }, { status: 400 });
  }

  if (params.redirect_uri && params.redirect_uri !== codePayload.redirectUri) {
    return NextResponse.json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch.' }, { status: 400 });
  }

  if (!verifyPkceS256(params.code_verifier || '', codePayload.codeChallenge)) {
    return NextResponse.json({ error: 'invalid_grant', error_description: 'PKCE code_verifier mismatch.' }, { status: 400 });
  }

  const tokens = createOAuthTokens(codePayload.clientId, codePayload.sub);
  return NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: 'studio:read studio:write',
    },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
  );
}
