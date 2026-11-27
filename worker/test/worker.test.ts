import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import type { Env, RepoSnapshot } from '../src/types.ts';

function makeMockKV(): KVNamespace {
  const map = new Map<string, string>();
  return {
    get: async (k: string) => map.get(k) ?? null,
    put: async (k: string, v: string) => {
      map.set(k, v);
    },
    delete: async (k: string) => {
      map.delete(k);
    },
  } as unknown as KVNamespace;
}

function makeMockR2(initial: Record<string, string> = {}): R2Bucket {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get: async (k: string) => {
      const val = map.get(k);
      if (val === undefined) return null;
      return { json: async () => JSON.parse(val), text: async () => val } as unknown as R2ObjectBody;
    },
    put: async (k: string, v: string) => {
      map.set(k, String(v));
      return null;
    },
  } as unknown as R2Bucket;
}

const SNAPSHOT: RepoSnapshot = {
  repo: 'bbthorson/demo',
  ref: 'main',
  sha: 'abc123',
  syncedAt: '2026-11-27T00:00:00Z',
  files: {
    'pinakes.yaml': `spec: 0.1
project:
  name: Worker Universe
  nsid: test.worker
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
probabilistic:
  heldSecrets:
    - id: secret-x
      description: "Do not reveal X"
`,
    'codex/entities.yaml': `characters:
  - id: char.emma
    type: character
    displayName: Emma
places:
  - id: place.bar
    type: place
    displayName: The Bar
`,
    'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "One"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
Emma stepped into The Bar.
`,
  },
};

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AI: {
      run: async (_model, input) => ({
        answers: ((input.questions as any[]) ?? []).map((q) => ({
          id: q.id,
          probabilities: q.type === 'binary' ? { yes: 0.1, no: 0.9 } : { '5': 1 },
        })),
      }),
    },
    SNAPSHOTS: makeMockR2({ 'snapshots/bbthorson/demo/main.json': JSON.stringify(SNAPSHOT) }),
    AUTH_KV: makeMockKV(),
    GITHUB_REPO: 'bbthorson/demo',
    GITHUB_REF: 'main',
    ALLOWED_GITHUB_USERS: 'bbthorson',
    MAX_DAILY_CLEF_CALLS: '2',
    PINAKES_MCP_TOKEN: 'secret-bearer-token',
    ...overrides,
  };
}

describe('Pinakes Cloudflare Worker MCP', () => {
  test('rejects unauthenticated requests with 401 and OAuth discovery header', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://pinakes.example/mcp/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      env
    );
    assert.equal(res.status, 401);
    assert.match(res.headers.get('WWW-Authenticate') ?? '', /oauth-protected-resource/);
  });

  test('/mcp/scene enforces firewall and /mcp/author exposes full suite + Workers AI Clef + daily quota', async () => {
    const env = makeEnv({ MAX_DAILY_CLEF_CALLS: '1' });
    const authHeaders = {
      Authorization: 'Bearer secret-bearer-token',
      'Content-Type': 'application/json',
    };

    const sceneList = await worker.fetch(
      new Request('https://pinakes.example/mcp/scene', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      env
    );
    assert.equal(sceneList.status, 200);
    const sceneJson: any = await sceneList.json();
    assert.deepEqual(
      sceneJson.result.tools.map((t: any) => t.name),
      ['pinakes_context', 'pinakes_brief', 'pinakes_sample', 'pinakes_compose']
    );

    // First prepass succeeds (consumes 1 of 1 daily Clef call)
    const pre1 = await worker.fetch(
      new Request('https://pinakes.example/mcp/author', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'pinakes_review_prepass', arguments: { story: '01_book', chapter: 1 } },
        }),
      }),
      env
    );
    assert.equal(pre1.status, 200);
    const pre1Json: any = await pre1.json();
    assert.notEqual(pre1Json.result.isError, true);

    // Second prepass hits daily Clef quota guard
    const pre2 = await worker.fetch(
      new Request('https://pinakes.example/mcp/author', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'pinakes_review_prepass', arguments: { story: '01_book', chapter: 1 } },
        }),
      }),
      env
    );
    const pre2Json: any = await pre2.json();
    assert.equal(pre2Json.result.isError, true);
    assert.match(pre2Json.result.content[0].text, /Daily Workers AI Clef quota reached/);
  });
});
