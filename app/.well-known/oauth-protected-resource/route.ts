import { NextResponse } from 'next/server';
import { getPublicOrigin } from '@/lib/mcp-oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return NextResponse.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
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
