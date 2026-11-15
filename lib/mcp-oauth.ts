import crypto from 'crypto';

function getOAuthSecret(): string | null {
  const explicit = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 16) return `${explicit}::mcp-oauth-v1`;
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && adminPw.length > 0) return `${adminPw}::mcp-oauth-v1`;
  const mcpKey = process.env.MCP_API_KEY;
  if (mcpKey && mcpKey.length >= 16) return `${mcpKey}::mcp-oauth-v1`;
  return null;
}

function signPayload(payload: Record<string, unknown>): string | null {
  const secret = getOAuthSecret();
  if (!secret) return null;
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedPayload<T extends Record<string, unknown>>(token: string): T | null {
  const secret = getOAuthSecret();
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthCodePayload extends Record<string, unknown> {
  type: 'auth_code';
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  sub: string;
  exp: number;
}

export interface AccessTokenPayload extends Record<string, unknown> {
  type: 'access_token' | 'refresh_token';
  clientId: string;
  sub: string;
  exp: number;
}

export function createAuthorizationCode(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  sub: string;
}): string | null {
  return signPayload({
    type: 'auth_code',
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod || 'S256',
    sub: params.sub,
    exp: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

export function verifyAuthorizationCode(code: string): AuthCodePayload | null {
  const parsed = verifySignedPayload<AuthCodePayload>(code);
  if (!parsed || parsed.type !== 'auth_code') return null;
  return parsed;
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeChallenge) return true; // If client didn't send PKCE
  if (!codeVerifier) return false;
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const a = Buffer.from(hash);
  const b = Buffer.from(codeChallenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createOAuthTokens(clientId: string, sub: string) {
  const accessToken = signPayload({
    type: 'access_token',
    clientId,
    sub,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  const refreshToken = signPayload({
    type: 'refresh_token',
    clientId,
    sub,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  return { accessToken, refreshToken, expiresIn: 7 * 24 * 60 * 60 };
}

export function verifyOAuthAccessToken(token: string): AccessTokenPayload | null {
  const parsed = verifySignedPayload<AccessTokenPayload>(token);
  if (!parsed || parsed.type !== 'access_token') return null;
  return parsed;
}

export function verifyOAuthRefreshToken(token: string): AccessTokenPayload | null {
  const parsed = verifySignedPayload<AccessTokenPayload>(token);
  if (!parsed || parsed.type !== 'refresh_token') return null;
  return parsed;
}

export function getPublicOrigin(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
