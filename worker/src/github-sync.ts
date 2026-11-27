/**
 * GitHub-to-R2 universe snapshot sync.
 *
 * GitHub remains the source of truth; R2 holds a disposable JSON snapshot of
 * all `.md`, `.yaml`, and `.yml` universe files keyed by `owner/repo/ref`, so
 * MCP requests hydrate `MemoryFS` in milliseconds without hitting GitHub rate
 * limits on every tool call.
 */
import type { RepoSnapshot } from './types.ts';

const INCLUDED_EXT = /\.(md|yaml|yml)$/i;
const IGNORED_PREFIXES = ['node_modules/', '.git/', 'dist/', 'cli/', 'docs/', 'site/'];
const MAX_FILE_BYTES = 512 * 1024;

function snapshotKey(repo: string, ref: string): string {
  return `snapshots/${repo}/${ref}.json`;
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pinakes-mcp-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/**
 * Loads a cached universe snapshot from R2, or syncs it from GitHub on cache miss.
 */
export async function loadOrSyncSnapshot(params: {
  r2: R2Bucket;
  repo: string;
  ref: string;
  githubToken?: string;
  forceRefresh?: boolean;
}): Promise<RepoSnapshot> {
  const key = snapshotKey(params.repo, params.ref);
  if (!params.forceRefresh) {
    const cached = await params.r2.get(key);
    if (cached) {
      return (await cached.json()) as RepoSnapshot;
    }
  }
  return syncRepoSnapshotToR2(params);
}

/**
 * Fetches the Git tree for `repo@ref` from GitHub, downloads all universe
 * `.md`/`.yaml`/`.yml` files, and stores the snapshot JSON in R2.
 */
export async function syncRepoSnapshotToR2(params: {
  r2: R2Bucket;
  repo: string;
  ref: string;
  githubToken?: string;
}): Promise<RepoSnapshot> {
  const headers = ghHeaders(params.githubToken);

  // 1. Resolve commit SHA for ref
  const refRes = await fetch(
    `https://api.github.com/repos/${params.repo}/commits/${encodeURIComponent(params.ref)}`,
    { headers }
  );
  if (!refRes.ok) {
    throw new Error(`GitHub commit lookup failed for ${params.repo}@${params.ref}: HTTP ${refRes.status}`);
  }
  const commitJson = (await refRes.json()) as { sha: string; commit: { tree: { sha: string } } };
  const sha = commitJson.sha;

  // 2. Fetch recursive tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${params.repo}/git/trees/${sha}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) {
    throw new Error(`GitHub tree fetch failed for ${params.repo}@${sha}: HTTP ${treeRes.status}`);
  }
  const treeJson = (await treeRes.json()) as {
    tree: { path: string; type: string; size?: number; sha: string }[];
  };

  const wanted = treeJson.tree.filter(
    (entry) =>
      entry.type === 'blob' &&
      INCLUDED_EXT.test(entry.path) &&
      (entry.size ?? 0) <= MAX_FILE_BYTES &&
      !IGNORED_PREFIXES.some((prefix) => entry.path.startsWith(prefix))
  );

  // 3. Fetch file contents in bounded parallel batches
  const files: Record<string, string> = {};
  const batchSize = 12;
  for (let i = 0; i < wanted.length; i += batchSize) {
    const batch = wanted.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (entry) => {
        const rawUrl = `https://api.github.com/repos/${params.repo}/contents/${entry.path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}?ref=${encodeURIComponent(sha)}`;
        const res = await fetch(rawUrl, {
          headers: { ...headers, Accept: 'application/vnd.github.raw+json' },
        });
        if (res.ok) {
          files[entry.path] = await res.text();
        }
      })
    );
  }

  const snapshot: RepoSnapshot = {
    repo: params.repo,
    ref: params.ref,
    sha,
    syncedAt: new Date().toISOString(),
    files,
  };

  await params.r2.put(snapshotKey(params.repo, params.ref), JSON.stringify(snapshot), {
    httpMetadata: { contentType: 'application/json' },
  });

  return snapshot;
}
