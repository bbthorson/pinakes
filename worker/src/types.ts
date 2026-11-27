export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  AI: AiBinding;
  SNAPSHOTS: R2Bucket;
  AUTH_KV: KVNamespace;

  // Vars
  GITHUB_REPO?: string;
  GITHUB_REF?: string;
  ALLOWED_GITHUB_USERS?: string;
  MAX_DAILY_CLEF_CALLS?: string;

  // Secrets (`wrangler secret put`)
  PINAKES_MCP_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_WEBHOOK_SECRET?: string;
}

export interface AuthSession {
  subject: string;
  method: 'bearer' | 'oauth';
  githubToken?: string;
}

export interface RepoSnapshot {
  repo: string;
  ref: string;
  sha: string;
  syncedAt: string;
  files: Record<string, string>;
}
