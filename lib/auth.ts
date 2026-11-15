export const SESSION_COOKIE_NAME = 'mc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSigningSecret(): string | null {
  const explicit = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword && adminPassword.length > 0) {
    return `${adminPassword}::metricool-studio-session-v1`;
  }
  return null;
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i];
  }
  return diff === 0;
}

export async function verifyAdminCredentials(
  password: string,
  email?: string
): Promise<boolean> {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) return false;

  const expectedEmail = process.env.ADMIN_EMAIL;
  if (expectedEmail && email) {
    if (!timingSafeEqualStrings(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase())) {
      return false;
    }
  } else if (expectedEmail && !email) {
    return false;
  }

  return timingSafeEqualStrings(password, expectedPassword);
}

export async function createSessionToken(subject = 'admin'): Promise<string | null> {
  const secret = getSigningSecret();
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = JSON.stringify({ sub: subject, exp });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const sig = await hmacSha256(secret, payloadB64);
  return `${payloadB64}.${toBase64Url(sig)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const secret = getSigningSecret();
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = await hmacSha256(secret, payloadB64);
  const actualSig = fromBase64Url(sigB64);
  if (!actualSig || actualSig.length !== expectedSig.length) return false;

  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig[i] ^ actualSig[i];
  }
  if (diff !== 0) return false;

  const payloadBytes = fromBase64Url(payloadB64);
  if (!payloadBytes) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as { exp?: number };
    if (typeof parsed.exp !== 'number') return false;
    return parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
