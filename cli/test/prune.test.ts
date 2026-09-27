/**
 * Stale record files: compile removes the pinakes files it no longer
 * produces, and nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chapter, run, withUniverse } from './helpers.ts';

const CH1 = 'stories/01_book/chapters/01_one.md';
const CUSTODY = 'custody:\n  - item: Key\n    holder: Emma\n';

const exists = (root: string, rel: string) => fs.existsSync(path.join(root, rel));
const write = (root: string, rel: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content);
};

test('a record type a book stops producing is removed', () => {
  withUniverse({ [CH1]: chapter({ num: 1, date: '2026-10-01', extra: CUSTODY }) }, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    assert.ok(exists(root, 'records/book1/custody_events.json'));

    write(root, CH1, chapter({ num: 1, date: '2026-10-01' }));
    const { status, output } = run(root, 'compile');
    assert.equal(status, 0);
    assert.match(output, /removed stale -> records\/book1\/custody_events\.json/);
    assert.ok(!exists(root, 'records/book1/custody_events.json'));
    assert.ok(exists(root, 'records/book1/scenes.json'));
  });
});

test('a deleted book loses its record directory', () => {
  withUniverse({ 'stories/02_sequel/chapters/01_one.md': chapter({ num: 1, date: '2026-11-01' }) }, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    assert.ok(exists(root, 'records/book2/scenes.json'));

    fs.rmSync(path.join(root, 'stories/02_sequel'), { recursive: true });
    assert.equal(run(root, 'compile').status, 0);
    assert.ok(!exists(root, 'records/book2'));
    assert.ok(exists(root, 'records/book1/scenes.json'));
  });
});

test('Lexicon documents for an old NSID are removed', () => {
  withUniverse({}, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    assert.ok(exists(root, 'records/lexicons/test.universe.scene.json'));

    const cfg = path.join(root, 'pinakes.yaml');
    fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf-8').replace('nsid: test.universe', 'nsid: test.renamed'));
    assert.equal(run(root, 'compile').status, 0);
    assert.ok(!exists(root, 'records/lexicons/test.universe.scene.json'));
    assert.ok(exists(root, 'records/lexicons/test.renamed.scene.json'));
  });
});

test("files pinakes did not name are never touched", () => {
  withUniverse({}, (root) => {
    const mine = ['records/README.md', 'records/book1/notes.json', 'records/lexicons/other.json', 'records/drafts/draft.md'];
    for (const rel of mine) write(root, rel, 'mine');
    fs.mkdirSync(path.join(root, 'records/empty'), { recursive: true });

    assert.equal(run(root, 'compile').status, 0);
    for (const rel of mine) assert.ok(exists(root, rel), rel);
    assert.ok(exists(root, 'records/empty'));
  });
});

test('lint builds records in memory and prunes nothing', () => {
  withUniverse({ [CH1]: chapter({ num: 1, date: '2026-10-01', extra: CUSTODY }) }, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    write(root, CH1, chapter({ num: 1, date: '2026-10-01' }));
    assert.equal(run(root, 'lint').status, 0);
    assert.ok(exists(root, 'records/book1/custody_events.json'));
  });
});

test('an output directory that is the project root is not pruned', () => {
  withUniverse({}, (root) => {
    const cfg = path.join(root, 'pinakes.yaml');
    fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf-8').replace('output: records', 'output: "."'));
    // One level down, with a pinakes file name, but the author's own.
    write(root, 'codex/items.json', 'mine');

    const { status, output } = run(root, 'compile');
    assert.equal(status, 0);
    assert.match(output, /stale record files were not removed/);
    assert.equal(fs.readFileSync(path.join(root, 'codex/items.json'), 'utf-8'), 'mine');
  });
});
