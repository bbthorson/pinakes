/**
 * Test fixtures: a minimal universe on disk, and a runner for the built CLI.
 *
 * Tests drive `dist/cli.js` as a subprocess rather than importing modules,
 * because the behaviour under test is the command's verdict — its exit code
 * and what it prints — which is what an author and CI actually see.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

const CONFIG = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
`;

const REGISTRY = `characters:
  - id: char.emma
    type: character
    displayName: Emma
  - id: char.leo
    type: character
    displayName: Leo
places:
  - id: place.bar
    type: place
    displayName: The Bar
items:
  - id: item.key
    type: item
    displayName: Key
`;

/** A valid chapter file. `extra` is raw frontmatter lines appended before the closing fence. */
export function chapter({ num, date, extra = '' }: { num: number; date: string; extra?: string }): string {
  return `---
chapter: ${num}
title: "Chapter ${num}"
date: "${date}"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
${extra}---
Body of chapter ${num}.
`;
}

/** Universe files by path relative to the root; `null` removes a default. */
export type Files = Record<string, string | null>;

/**
 * Creates a clean universe in a temp directory. `files` maps a path relative
 * to the universe root to its contents; they are written over the defaults.
 * By default the universe has one valid chapter and lints clean.
 */
export function makeUniverse(files: Files = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pinakes-test-'));
  const all = {
    'pinakes.yaml': CONFIG,
    'codex/entities.yaml': REGISTRY,
    'stories/01_book/chapters/01_one.md': chapter({ num: 1, date: '2026-10-01' }),
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    if (content === null) continue;
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf-8');
  }
  return root;
}

/** Builds a universe, hands it to `fn`, and always removes it. */
export function withUniverse(files: Files, fn: (root: string) => void): void {
  const root = makeUniverse(files);
  try {
    fn(root);
  } finally {
    cleanup(root);
  }
}

/** Appends to `pinakes.yaml`, for tests that need extra configuration. */
export function appendConfig(root: string, text: string): void {
  fs.appendFileSync(path.join(root, 'pinakes.yaml'), text, 'utf-8');
}

/** Runs the CLI in `root`. Returns the exit code and combined output. */
export function run(root: string, ...args: string[]): { status: number | null; output: string } {
  const res = spawnSync(process.execPath, [CLI, ...args, '--root', root], {
    encoding: 'utf-8',
  });
  return { status: res.status, output: `${res.stdout}${res.stderr}` };
}

/** Parses a compiled record file. Typed loosely: tests reach into whatever records it holds. */
export function readJson(root: string, rel: string): Record<string, any>[] {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
}

export function cleanup(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
