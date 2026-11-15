import { NextResponse } from 'next/server';
import crypto from 'crypto';

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
  const body = (await req.json().catch(() => ({}))) as {
    client_name?: string;
    redirect_uris?: string[];
  };

  const clientId = `chatgpt_mcp_${crypto.randomBytes(8).toString('hex')}`;
  return NextResponse.json(
    {
      client_id: clientId,
      client_name: body.client_name || 'ChatGPT MCP Client',
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    }
  );
}
