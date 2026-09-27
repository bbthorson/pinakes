/**
 * The programmatic API. Unlike the other suites these import the package
 * rather than spawning the CLI, because the promise under test is what an
 * importer gets: findings returned rather than printed, and no disk writes
 * unless asked for.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chapter, cleanup, makeUniverse } from './helpers.mjs';
import * as pinakes from '@bbthorson/pinakes';

const CH1 = 'stories/01_book/chapters/01_one.md';

function withUniverse(files, fn) {
  const root = makeUniverse(files);
  try {
    fn(root);
  } finally {
    cleanup(root);
  }
}

test('importing the package does not run the CLI', () => {
  // `main` used to point at dist/cli.js, which parses process.argv on load:
  // an importer run as `node app.mjs lint` would have run lint and exited.
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('@bbthorson/pinakes')", 'lint'], {
    cwd: path.dirname(new URL(import.meta.url).pathname),
    encoding: 'utf-8',
  });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '');
});

describe('lint', () => {
  test('returns an error diagnostic and ok: false for a broken universe', () => {
    const broken = { [CH1]: chapter({ num: 1, date: '2026-10-01' }).replace('pov: Emma', 'pov: Nobody') };
    withUniverse(broken, (root) => {
      const { ok, diagnostics } = pinakes.lint(root);
      assert.equal(ok, false);
      assert.ok(diagnostics.some((d) => d.rule === 'unresolved-entities' && d.severity === 'error'));
      assert.equal(fs.existsSync(path.join(root, 'records')), false);
    });
  });

  test('accepts an opened universe', () => {
    withUniverse({}, (root) => {
      const universe = pinakes.openUniverse(root);
      assert.deepEqual(pinakes.lint(universe), { ok: true, diagnostics: [] });
    });
  });

  test('throws when there is no pinakes.yaml', () => {
    withUniverse({ 'pinakes.yaml': null }, (root) => {
      assert.throws(() => pinakes.lint(root), /Could not find pinakes.yaml/);
    });
  });
});

describe('compile', () => {
  test('returns records in memory and writes nothing by default', () => {
    withUniverse({}, (root) => {
      const { ok, records } = pinakes.compile(root);
      assert.equal(ok, true);
      assert.ok(records.some((r) => r.id === 'scene.book1.ch1'));
      assert.equal(fs.existsSync(path.join(root, 'records')), false);
    });
  });

  test('writes records when asked', () => {
    withUniverse({}, (root) => {
      const { ok, results } = pinakes.compile(root, { write: true });
      assert.equal(ok, true);
      for (const { file } of results) assert.ok(fs.existsSync(path.join(root, file)), file);
    });
  });
});

describe('context', () => {
  test('returns a bundle for a registry character', () => {
    withUniverse({}, (root) => {
      const { bundle, errors } = pinakes.context(root, 'Emma', '2026-10-02');
      assert.deepEqual(errors, []);
      assert.equal(bundle.character.id, 'char.emma');
      assert.match(pinakes.renderContextMarkdown(bundle), /Emma/);
    });
  });

  test('returns errors, not a throw, for an unknown character', () => {
    withUniverse({}, (root) => {
      const { bundle, errors } = pinakes.context(root, 'Nobody', '2026-10-02');
      assert.equal(bundle, undefined);
      assert.match(errors[0], /does not resolve/);
    });
  });
});

describe('proseCheck', () => {
  test('returns the requested report', () => {
    withUniverse({}, (root) => {
      const reports = pinakes.proseCheck(root, { report: 'closers' });
      assert.deepEqual(Object.keys(reports), ['closers']);
    });
  });

  test('throws rather than returning an empty report for a story that matches nothing', () => {
    withUniverse({}, (root) => {
      assert.throws(() => pinakes.proseCheck(root, { story: 'no-such-book' }), /No stories found/);
    });
  });
});

describe('compiled register expressions', () => {
  test('a transition with a note on its first step keeps the transition', () => {
    // The compiler cut at the first `(`, so this compiled as `under-pressure`.
    const value = 'under-pressure (hostess hyperdrive) → private (the quiet kitchen confide)';
    withUniverse({ [CH1]: chapter({ num: 1, date: '2026-10-01', extra: `registers:\n  Emma: "${value}"\n` }) }, (root) => {
      const event = pinakes.compile(root).records.find((r) => r.$type.endsWith('.character.stateEvent'));
      assert.equal(event.register, 'under-pressure');
      assert.equal(event.registerExpr, 'under-pressure → private');
      assert.equal(event.state, value);
    });
  });
});
