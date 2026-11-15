import { NextResponse } from 'next/server';
import { getPublicOrigin } from '@/lib/mcp-oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
      token_endpoint: `${origin}/api/mcp/oauth/token`,
      registration_endpoint: `${origin}/api/mcp/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: ['studio:read', 'studio:write'],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    }
  );
}
