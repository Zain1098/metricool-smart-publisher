import { NextResponse } from 'next/server';
import { isAdminAuthConfigured, verifyAdminCredentials } from '@/lib/auth';
import { createAuthorizationCode } from '@/lib/mcp-oauth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function renderAuthPage(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
}) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ChatGPT — ZCodeDev Studio</title>
  <style>
    body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:#FBF9F5; color:#1C1917; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:16px; }
    .card { width:100%; max-width:420px; background:#FFFFFF; border:1px solid #E7E2D8; border-radius:16px; padding:28px; box-shadow:0 8px 30px rgba(28,25,23,0.06); }
    .badge { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:4px 10px; border-radius:999px; background:#FEF3C7; color:#92400E; margin-bottom:12px; }
    h1 { margin:0 0 8px; font-size:20px; font-weight:700; }
    p { margin:0 0 18px; font-size:13px; color:#57534E; line-height:1.5; }
    label { display:block; font-size:12px; font-weight:600; margin-bottom:6px; color:#44403C; }
    input[type=password], input[type=email] { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #D6D0C4; border-radius:10px; font-size:14px; background:#FBF9F5; color:#1C1917; margin-bottom:14px; }
    button { width:100%; padding:11px 16px; border:none; border-radius:10px; background:#1C1917; color:#FFFFFF; font-size:14px; font-weight:600; cursor:pointer; }
    button:hover { background:#292524; }
    .err { background:#FEE2E2; color:#991B1B; border:1px solid #FECACA; padding:10px 12px; border-radius:10px; font-size:12px; margin-bottom:14px; }
    .meta { margin-top:14px; font-size:11px; color:#78716C; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">ZCodeDev Studio MCP</span>
    <h1>Connect ChatGPT to Your Studio</h1>
    <p>Enter your studio admin password to grant ChatGPT access to manage your posts, analytics, media, and settings.</p>
    ${params.error ? `<div class="err">${escapeHtml(params.error)}</div>` : ''}
    <form method="POST" action="/api/mcp/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
      <label for="password">Admin Password</label>
      <input id="password" name="password" type="password" required autofocus placeholder="Enter ADMIN_PASSWORD" />
      <button type="submit">Approve &amp; Connect ChatGPT</button>
    </form>
    <div class="meta">Client: ${escapeHtml(params.clientId || 'chatgpt')} • OAuth 2.1 PKCE</div>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id') || 'chatgpt';
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  const state = url.searchParams.get('state') || '';
  const codeChallenge = url.searchParams.get('code_challenge') || '';
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';

  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Valid HTTPS redirect_uri is required.' }, { status: 400 });
  }

  return renderAuthPage({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    error: !isAdminAuthConfigured() ? 'ADMIN_PASSWORD is not configured on the server.' : undefined,
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`mcp_oauth:${ip}`, 15, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const clientId = String(form.get('client_id') || 'chatgpt');
  const redirectUri = String(form.get('redirect_uri') || '');
  const state = String(form.get('state') || '');
  const codeChallenge = String(form.get('code_challenge') || '');
  const codeChallengeMethod = String(form.get('code_challenge_method') || 'S256');
  const password = String(form.get('password') || '');

  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!isAdminAuthConfigured()) {
    return renderAuthPage({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      error: 'ADMIN_PASSWORD is not configured in Netlify environment variables.',
    });
  }

  const valid = await verifyAdminCredentials(password);
  if (!valid) {
    return renderAuthPage({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      error: 'Invalid admin password. Please try again.',
    });
  }

  const code = createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    sub: 'admin',
  });

  if (!code) {
    return renderAuthPage({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      error: 'Failed to sign authorization code.',
    });
  }

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl.toString(), 302);
}
