/**
 * Hosted Cloudflare Worker MCP server for Pinakes.
 *
 * Endpoints:
 * - `POST /mcp/scene`   — Firewalled Scene-Mode MCP (context/brief/sample/compose only)
 * - `POST /mcp/author`  — Full Author-Mode MCP (+ lint, prose-check, 6-lens review, sync)
 * - `GET  /.well-known/oauth-protected-resource`
 * - `GET  /.well-known/oauth-authorization-server`
 * - `POST /oauth/register`  — Dynamic client registration (for Claude.ai / MCP clients)
 * - `GET  /oauth/authorize` — Redirects to GitHub OAuth
 * - `GET  /oauth/callback`  — Exchanges GitHub code, enforces ALLOWED_GITHUB_USERS allowlist
 * - `POST /oauth/token`     — PKCE code -> MCP Bearer token exchange
 * - `POST /webhook/github`  — HMAC-SHA256 verified push webhook -> refreshes R2 snapshot
 * - `GET  /health`
 */
import {
  PinakesMcpServer,
  openMemoryUniverse,
  type JsonRpcRequest,
  type McpExtraTool,
  type McpMode,
} from '@bbthorson/pinakes';
import {
  allowedGithubUsers,
  authenticateRequest,
  pkceS256,
  randomToken,
  unauthorizedResponse,
  verifyGithubWebhook,
} from './auth.ts';
import { loadOrSyncSnapshot, syncRepoSnapshotToR2 } from './github-sync.ts';
import { WorkersAiClefScorer } from './workers-ai-scorer.ts';
import type { AuthSession, Env } from './types.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id',
};

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

async function handleOAuthAuthorize(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return jsonResponse({ error: 'oauth_not_configured' }, 500);
  }
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const codeChallenge = url.searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? 'S256';
  const clientId = url.searchParams.get('client_id') ?? '';

  if (!redirectUri) return jsonResponse({ error: 'invalid_request', message: 'Missing redirect_uri' }, 400);

  const ghState = randomToken(24);
  await env.AUTH_KV.put(
    `oauth_state:${ghState}`,
    JSON.stringify({ redirectUri, state, codeChallenge, codeChallengeMethod, clientId }),
    { expirationTtl: 600 }
  );

  const callbackUrl = `${url.origin}/oauth/callback`;
  const ghUrl = new URL('https://github.com/login/oauth/authorize');
  ghUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  ghUrl.searchParams.set('redirect_uri', callbackUrl);
  ghUrl.searchParams.set('scope', 'read:user repo');
  ghUrl.searchParams.set('state', ghState);
  return Response.redirect(ghUrl.toString(), 302);
}

async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const ghState = url.searchParams.get('state');
  if (!code || !ghState) return jsonResponse({ error: 'invalid_request' }, 400);

  const savedRaw = await env.AUTH_KV.get(`oauth_state:${ghState}`);
  if (!savedRaw) return jsonResponse({ error: 'invalid_state' }, 400);
  await env.AUTH_KV.delete(`oauth_state:${ghState}`);
  const saved = JSON.parse(savedRaw) as {
    redirectUri: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: string;
  };

  // Exchange GitHub code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/oauth/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    return jsonResponse({ error: 'github_token_exchange_failed', detail: tokenJson.error }, 401);
  }

  // Fetch GitHub user and enforce strict allowlist (fail closed!)
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'User-Agent': 'pinakes-mcp-worker',
      Accept: 'application/vnd.github+json',
    },
  });
  const userJson = (await userRes.json()) as { login?: string };
  const login = userJson.login?.toLowerCase() ?? '';
  const allow = allowedGithubUsers(env);
  if (!login || allow.size === 0 || !allow.has(login)) {
    return jsonResponse(
      { error: 'access_denied', message: `GitHub user '${login || 'unknown'}' is not on ALLOWED_GITHUB_USERS.` },
      403
    );
  }

  const authCode = randomToken(32);
  await env.AUTH_KV.put(
    `oauth_code:${authCode}`,
    JSON.stringify({
      subject: login,
      githubToken: tokenJson.access_token,
      redirectUri: saved.redirectUri,
      codeChallenge: saved.codeChallenge,
      codeChallengeMethod: saved.codeChallengeMethod,
    }),
    { expirationTtl: 300 }
  );

  const dest = new URL(saved.redirectUri);
  dest.searchParams.set('code', authCode);
  if (saved.state) dest.searchParams.set('state', saved.state);
  return Response.redirect(dest.toString(), 302);
}

async function handleOAuthToken(request: Request, env: Env): Promise<Response> {
  const ct = request.headers.get('Content-Type') ?? '';
  const params = ct.includes('application/json')
    ? new URLSearchParams(Object.entries((await request.json()) as Record<string, string>))
    : new URLSearchParams(await request.text());

  const grantType = params.get('grant_type');
  const code = params.get('code') ?? '';
  const codeVerifier = params.get('code_verifier') ?? '';
  if (grantType !== 'authorization_code' || !code) {
    return jsonResponse({ error: 'invalid_grant' }, 400);
  }

  const raw = await env.AUTH_KV.get(`oauth_code:${code}`);
  if (!raw) return jsonResponse({ error: 'invalid_grant' }, 400);
  await env.AUTH_KV.delete(`oauth_code:${code}`);

  const record = JSON.parse(raw) as {
    subject: string;
    githubToken: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  };

  if (record.codeChallenge) {
    const computed =
      record.codeChallengeMethod === 'plain' ? codeVerifier : await pkceS256(codeVerifier);
    if (computed !== record.codeChallenge) {
      return jsonResponse({ error: 'invalid_grant', message: 'PKCE verification failed' }, 400);
    }
  }

  const accessToken = randomToken(32);
  const ttlSeconds = 60 * 60 * 24; // 24h
  const session: AuthSession = {
    subject: record.subject,
    method: 'oauth',
    githubToken: record.githubToken,
  };
  await env.AUTH_KV.put(`session:${accessToken}`, JSON.stringify(session), { expirationTtl: ttlSeconds });

  return jsonResponse({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ttlSeconds,
  });
}

async function handleMcpRequest(
  request: Request,
  env: Env,
  mode: McpMode,
  session: AuthSession
): Promise<Response> {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo') ?? env.GITHUB_REPO ?? '';
  const ref = url.searchParams.get('ref') ?? env.GITHUB_REF ?? 'main';
  if (!repo) {
    return jsonResponse({ error: 'Missing GITHUB_REPO var or ?repo=owner/repo query parameter.' }, 400);
  }

  const githubToken = session.githubToken ?? env.GITHUB_TOKEN;
  const maxDailyCalls = parseInt(env.MAX_DAILY_CLEF_CALLS ?? '500', 10) || 500;

  const extraTools: McpExtraTool[] =
    mode === 'author'
      ? [
          {
            definition: {
              name: 'pinakes_sync',
              description: 'Force-refresh the R2 universe snapshot from GitHub for the configured repo and ref.',
              inputSchema: {
                type: 'object',
                properties: {
                  repo: { type: 'string', description: 'Optional owner/repo override' },
                  ref: { type: 'string', description: 'Optional branch/tag/SHA override' },
                },
              },
            },
            handler: async (args) => {
              const snap = await syncRepoSnapshotToR2({
                r2: env.SNAPSHOTS,
                repo: args.repo ? String(args.repo) : repo,
                ref: args.ref ? String(args.ref) : ref,
                githubToken,
              });
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        repo: snap.repo,
                        ref: snap.ref,
                        sha: snap.sha,
                        syncedAt: snap.syncedAt,
                        fileCount: Object.keys(snap.files).length,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            },
          },
        ]
      : [];

  const server = new PinakesMcpServer({
    mode,
    getUniverse: async () => {
      const snap = await loadOrSyncSnapshot({ r2: env.SNAPSHOTS, repo, ref, githubToken });
      return openMemoryUniverse(snap.files);
    },
    getScorer: (tier) =>
      new WorkersAiClefScorer({
        ai: env.AI,
        model: tier === 'flash' ? '@cf/cloudflare/clef-flash' : '@cf/cloudflare/clef',
        kv: env.AUTH_KV,
        maxDailyCalls,
      }),
    extraTools,
  });

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return jsonResponse(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } },
      400
    );
  }

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((m) => server.handleJsonRpc(m)))).filter(Boolean);
    return jsonResponse(results);
  }

  const resp = await server.handleJsonRpc(body);
  if (resp === null) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return jsonResponse(resp);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, service: 'pinakes-mcp' });
    }

    // OAuth 2.1 Discovery (RFC 9728 & RFC 8414) for Claude.ai / remote MCP clients
    if (pathname === '/.well-known/oauth-protected-resource') {
      return jsonResponse({
        resource: url.origin,
        authorization_servers: [url.origin],
        bearer_methods_supported: ['header'],
      });
    }
    if (pathname === '/.well-known/oauth-authorization-server') {
      return jsonResponse({
        issuer: url.origin,
        authorization_endpoint: `${url.origin}/oauth/authorize`,
        token_endpoint: `${url.origin}/oauth/token`,
        registration_endpoint: `${url.origin}/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    }
    if (pathname === '/oauth/register' && request.method === 'POST') {
      const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return jsonResponse(
        {
          client_id: randomToken(16),
          client_name: payload.client_name ?? 'mcp-client',
          redirect_uris: payload.redirect_uris ?? [],
          token_endpoint_auth_method: 'none',
        },
        201
      );
    }
    if (pathname === '/oauth/authorize' && request.method === 'GET') {
      return handleOAuthAuthorize(request, env);
    }
    if (pathname === '/oauth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request, env);
    }
    if (pathname === '/oauth/token' && request.method === 'POST') {
      return handleOAuthToken(request, env);
    }

    // GitHub push webhook -> refreshes R2 cache automatically
    if (pathname === '/webhook/github' && request.method === 'POST') {
      const raw = await request.text();
      const valid = await verifyGithubWebhook(
        raw,
        request.headers.get('X-Hub-Signature-256'),
        env.GITHUB_WEBHOOK_SECRET
      );
      if (!valid) return jsonResponse({ error: 'invalid_signature' }, 401);

      const payload = JSON.parse(raw) as { repository?: { full_name?: string }; ref?: string };
      const repo = payload.repository?.full_name ?? env.GITHUB_REPO;
      const ref = payload.ref?.replace(/^refs\/heads\//, '') ?? env.GITHUB_REF ?? 'main';
      if (!repo) return jsonResponse({ error: 'missing_repo' }, 400);

      const snap = await syncRepoSnapshotToR2({
        r2: env.SNAPSHOTS,
        repo,
        ref,
        githubToken: env.GITHUB_TOKEN,
      });
      return jsonResponse({ ok: true, repo: snap.repo, ref: snap.ref, sha: snap.sha });
    }

    // Protected MCP endpoints
    if ((pathname === '/mcp/scene' || pathname === '/mcp/author') && request.method === 'POST') {
      const session = await authenticateRequest(request, env);
      if (!session) return unauthorizedResponse(request);
      const mode: McpMode = pathname === '/mcp/scene' ? 'scene' : 'author';
      return handleMcpRequest(request, env, mode, session);
    }

    return jsonResponse({ error: 'not_found' }, 404);
  },
};
