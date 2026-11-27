/**
 * Authentication and usage protection for the hosted Pinakes Cloudflare Worker.
 *
 * Supports two fail-closed auth paths:
 * 1. Static Bearer token (`PINAKES_MCP_TOKEN`) for personal scripts / CLI.
 * 2. OAuth 2.1 + PKCE backed by GitHub OAuth + strict `ALLOWED_GITHUB_USERS`
 *    allowlist for remote web MCP clients (Claude.ai, etc.).
 *
 * Also verifies GitHub webhook HMAC-SHA256 signatures.
 */
import type { AuthSession, Env } from './types.ts';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

/** Constant-time string equality using SHA-256 digests. */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ua = new Uint8Array(ha);
  const ub = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0 && a.length === b.length;
}

export function allowedGithubUsers(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_GITHUB_USERS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Authenticates an incoming MCP request. Returns `null` if unauthorized.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthSession | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;

  // 1. Static personal Bearer token
  if (env.PINAKES_MCP_TOKEN && (await timingSafeEqual(token, env.PINAKES_MCP_TOKEN))) {
    return { subject: 'bearer-owner', method: 'bearer', githubToken: env.GITHUB_TOKEN };
  }

  // 2. OAuth session token stored in KV
  if (env.AUTH_KV) {
    const raw = await env.AUTH_KV.get(`session:${token}`);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthSession;
      const allow = allowedGithubUsers(env);
      if (allow.size > 0 && allow.has(parsed.subject.toLowerCase())) {
        return parsed;
      }
    }
  }

  return null;
}

export function unauthorizedResponse(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

/** Verifies GitHub `X-Hub-Signature-256` webhook header. */
export async function verifyGithubWebhook(
  bodyText: string,
  signatureHeader: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(bodyText));
  const expected = `sha256=${toHex(sig)}`;
  return timingSafeEqual(expected, signatureHeader);
}

/** Computes PKCE S256 code_challenge from code_verifier. */
export async function pkceS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}
