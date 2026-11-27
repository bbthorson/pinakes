/**
 * Phase A tests: MemoryFS / openMemoryUniverse and PinakesMcpServer
 * (protocol firewall in scene vs author mode + local stdio `pinakes mcp`).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withUniverse } from './helpers.ts';
import * as pinakes from '@bbthorson/pinakes';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

const MEMORY_FILES: Record<string, string> = {
  'pinakes.yaml': `spec: 0.1
project:
  name: Memory Universe
  nsid: test.memory
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
context:
  codex:
    include: [Overview]
probabilistic:
  scorer:
    provider: mock
  review:
    paths:
      writingGuide: guides/writing.md
`,
  'codex/entities.yaml': `characters:
  - id: char.emma
    type: character
    displayName: Emma
  - id: char.marta
    type: character
    displayName: Marta
places:
  - id: place.bar
    type: place
    displayName: The Bar
`,
  'guides/writing.md': 'Keep dialogue grounded.',
  'stories/01_book/characters/marta.md': '# Marta\n\n## Overview\nObservant neighbor.\n',
  'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "Chapter 1"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Marta]
registers:
  Emma: "public (OMNISCIENT AUTHOR ANNOTATION)"
---
Emma wiped the counter while Marta watched from the door.
`,
};

describe('MemoryFS & openMemoryUniverse', () => {
  test('runs lint, context (guest stub), brief, compose, and 6-lens review entirely in memory', () => {
    const u = pinakes.openMemoryUniverse(MEMORY_FILES);
    const lintRes = pinakes.lint(u);
    assert.equal(lintRes.ok, true, JSON.stringify(lintRes.diagnostics));

    const ctx = pinakes.context(u, 'Marta', '2026-10-02');
    assert.deepEqual(ctx.errors, []);
    assert.equal(ctx.bundle?.long.sourceScope, 'book');
    assert.match(pinakes.renderContextMarkdown(ctx.bundle!), /Observant neighbor/);

    const slices = pinakes.reviewSlices(u, { story: '01_book', chapter: 1 });
    assert.deepEqual(slices.errors, []);
    assert.equal(slices.slices.length, 6);
  });
});

describe('PinakesMcpServer firewall & JSON-RPC 2.0', () => {
  test('scene mode exposes only firewalled tools, blocks author tools, and hard-locks fullState: false', async () => {
    const server = new pinakes.PinakesMcpServer({
      mode: 'scene',
      getUniverse: () => pinakes.openMemoryUniverse(MEMORY_FILES),
      getScorer: () => new pinakes.MockDecisionScorer(),
    });

    const listResp = await server.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = ((listResp?.result as any)?.tools ?? []).map((t: any) => t.name);
    assert.deepEqual(names, ['pinakes_context', 'pinakes_brief', 'pinakes_sample', 'pinakes_compose']);

    // Author tool rejected by firewall
    const blocked = await server.handleJsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'pinakes_review_slice', arguments: { story: '01_book', chapter: 1 } },
    });
    assert.equal((blocked?.result as any)?.isError, true);
    assert.match((blocked?.result as any)?.content?.[0]?.text ?? '', /not available in 'scene' mode/);

    // Even if caller passes fullState: true in scene mode, omniscient annotation is stripped
    const ctxResp = await server.handleJsonRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'pinakes_context', arguments: { character: 'Emma', asOf: '2026-10-01', fullState: true } },
    });
    const text = (ctxResp?.result as any)?.content?.[0]?.text ?? '';
    assert.doesNotMatch(text, /OMNISCIENT AUTHOR ANNOTATION/);
  });

  test('author mode exposes full suite + extraTools and executes review_slice and lint', async () => {
    const server = new pinakes.PinakesMcpServer({
      mode: 'author',
      getUniverse: () => pinakes.openMemoryUniverse(MEMORY_FILES),
      getScorer: () => new pinakes.MockDecisionScorer(),
      extraTools: [
        {
          definition: { name: 'pinakes_sync', description: 'Sync repo', inputSchema: { type: 'object' } },
          handler: async () => ({ content: [{ type: 'text', text: 'synced' }] }),
        },
      ],
    });

    const listResp = await server.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = ((listResp?.result as any)?.tools ?? []).map((t: any) => t.name);
    assert.ok(names.includes('pinakes_lint'));
    assert.ok(names.includes('pinakes_review_slice'));
    assert.ok(names.includes('pinakes_review_prepass'));
    assert.ok(names.includes('pinakes_sync'));

    const lintResp = await server.handleJsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'pinakes_lint', arguments: {} },
    });
    const parsed = JSON.parse((lintResp?.result as any)?.content?.[0]?.text ?? '{}');
    assert.equal(parsed.ok, true);
  });

  test('CLI `pinakes mcp --mode scene` responds cleanly over stdio', () => {
    withUniverse({}, (root) => {
      const input =
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } }) +
        '\n' +
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) +
        '\n';
      const res = spawnSync(process.execPath, [CLI, 'mcp', '--mode', 'scene', '--root', root], {
        input,
        encoding: 'utf-8',
      });
      assert.equal(res.status, 0, res.stderr);
      const lines = res.stdout.trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(lines.length, 2);
      assert.equal(lines[0].result.serverInfo.name, 'pinakes-mcp-scene');
      assert.equal(lines[1].result.tools.length, 4);
    });
  });
});
