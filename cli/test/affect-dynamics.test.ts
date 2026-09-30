/**
 * Affect dynamics (design/affect-dynamics.md): a character's state between
 * declarations, replayed from their latest declared stretch through chapter
 * events and relaxing toward a codex baseline.
 *
 * The universe here is the design's §11 worked example, on Emma: baseline
 * 0/0/10, half-life 4 days, an Oct 2 stretch declaring `subdued`
 * (-20/-30/-30), and an Oct 5 chapter declaring `curious → angry`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { affectStateAt } from '@bbthorson/pinakes';
import { chapter, readJson, run, withUniverse, type Files } from './helpers.ts';

const REGISTRY = `characters:
  - id: char.emma
    type: character
    displayName: Emma
    sourceFile: codex/characters/emma.md
  - id: char.leo
    type: character
    displayName: Leo
places:
  - id: place.bar
    type: place
    displayName: The Bar
`;

const CONFIG = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
affect:
  labels:
    subdued: { v: -20, a: -30, d: -30 }
    angry: { v: -60, a: 60, d: 40 }
`;

const DYNAMICS = `  dynamics:
    halfLifeDays: 4
    discontinuity: 60
`;

function codex(frontmatter = 'affectBaseline: { v: 0, a: 0, d: 10 }\n'): string {
  return `---\n${frontmatter}---\n# Emma\n`;
}

function stretch(asOf: string, affect: string, status = 'approved'): string {
  return `---
character: Emma
asOf: "${asOf}"
since: "2026-09-01"
register: private
status: ${status}
sources:
  - scene.book1.ch1
affect: ${affect}
---
The weeks, looking back.
`;
}

const ch = (num: number, date: string, affect = '') =>
  chapter({ num, date, extra: `registers:\n  Emma: private\n${affect ? `affect:\n  Emma: "${affect}"\n` : ''}` });

/** The §11 universe, with dynamics on unless `config` replaces them. */
function worked(overrides: Files = {}, dynamics = DYNAMICS): Files {
  return {
    'pinakes.yaml': CONFIG + dynamics,
    'codex/entities.yaml': REGISTRY,
    'codex/characters/emma.md': codex(),
    'stories/01_book/chapters/01_one.md': ch(1, '2026-10-01'),
    'stories/01_book/stretches/emma/2026-10-02.md': stretch('2026-10-02', 'subdued'),
    'stories/01_book/chapters/02_two.md': ch(2, '2026-10-05', 'curious → angry'),
    ...overrides,
  };
}

const coords = (root: string, asOf: string) => {
  const { state, errors } = affectStateAt(root, 'Emma', asOf);
  assert.deepEqual(errors, []);
  return state;
};

test('the worked example: states and basins at each date', () => {
  withUniverse(worked(), (root) => {
    const oct2 = coords(root, '2026-10-02')!;
    assert.equal(oct2.mode, 'replayed');
    assert.deepEqual(oct2.coordinates, { valence: -20, arousal: -30, dominance: -30 });
    assert.equal(oct2.attractorBasin, undefined);
    assert.deepEqual(oct2.events, []);

    const oct5 = coords(root, '2026-10-05')!;
    assert.deepEqual(oct5.coordinates, { valence: -60, arousal: 60, dominance: 40 }, 'a label transition is an endpoint');

    const oct8 = coords(root, '2026-10-08')!;
    assert.deepEqual(oct8.coordinates, { valence: -36, arousal: 36, dominance: 28 });
    assert.equal(oct8.attractorBasin, 'hyper-vigilant');
    assert.deepEqual(oct8.events, [{ id: 'affect.event.emma.book1.ch2', end: '2026-10-05' }]);
    assert.equal(oct8.anchor.id, 'stretch.emma.book1.2026-10-02');

    const oct15 = coords(root, '2026-10-15')!;
    assert.deepEqual(oct15.coordinates, { valence: -11, arousal: 11, dominance: 15 });
    assert.equal(oct15.attractorBasin, 'grounded-stoic');
  });
});

test('the event record carries from, to and the delta', () => {
  withUniverse(worked(), (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const [e] = readJson(root, 'records/book1/character_affect_events.json');
    assert.deepEqual(e.from, { valence: 40, arousal: 30, dominance: 20 });
    assert.deepEqual(e.to, { valence: -60, arousal: 60, dominance: 40 });
    assert.deepEqual(e.delta, { valence: -100, arousal: 30, dominance: 20 });
  });
});

test('entering a chapter far from its declared first step is a discontinuity warning', () => {
  withUniverse(worked(), (root) => {
    const linted = run(root, 'lint');
    assert.equal(linted.status, 0, 'a warning, never an error');
    assert.match(linted.output, /\[affect-discontinuity\].*affect\.event\.emma\.book1\.ch2.*distance 78/);
  });
  // Unset threshold: not checked.
  withUniverse(worked({}, '  dynamics:\n    halfLifeDays: 4\n'), (root) => {
    assert.doesNotMatch(run(root, 'lint').output, /affect-discontinuity/);
  });
});

test('context shows the replayed state with its working', () => {
  withUniverse(worked(), (root) => {
    const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-08');
    assert.equal(ctx.status, 0, ctx.output);
    assert.ok(ctx.output.includes('DIMENSIONS: Valence=-0.36 | Arousal=0.36 | Dominance=0.28'), ctx.output);
    assert.ok(ctx.output.includes('ATTRACTOR: hyper-vigilant'));
    assert.ok(ctx.output.includes('ANCHOR: stretch.emma.book1.2026-10-02'));
    assert.ok(ctx.output.includes('EVENT: affect.event.emma.book1.ch2 (ended 2026-10-05, 3 days before)'));
    assert.ok(ctx.output.includes('DECAY: half-life 4 days toward baseline'));
  });
});

test('without affect.dynamics the state is the latest stretch as declared, with no working shown', () => {
  withUniverse(worked({}, ''), (root) => {
    const oct8 = coords(root, '2026-10-08')!;
    assert.equal(oct8.mode, 'declared');
    assert.deepEqual(oct8.coordinates, { valence: -20, arousal: -30, dominance: -30 });
    const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-08');
    assert.ok(!ctx.output.includes('ANCHOR:'));
    assert.doesNotMatch(run(root, 'lint').output, /affect-discontinuity/);
  });
});

test('no anchoring stretch: no state, even with events and a baseline', () => {
  withUniverse(worked({ 'stories/01_book/stretches/emma/2026-10-02.md': null }), (root) => {
    assert.equal(coords(root, '2026-10-08'), undefined);
    assert.ok(!run(root, 'context', 'Emma', '--as-of', '2026-10-08').output.includes('Affect state'));
  });
});

test('no baseline: the state holds after the last event, and says so', () => {
  withUniverse(worked({ 'codex/characters/emma.md': codex('status: active\n') }), (root) => {
    const oct15 = coords(root, '2026-10-15')!;
    assert.equal(oct15.mode, 'held');
    assert.deepEqual(oct15.coordinates, { valence: -60, arousal: 60, dominance: 40 });
    const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-15');
    assert.ok(ctx.output.includes('DECAY: not decaying: no baseline'), ctx.output);
  });
});

test('affectHalfLifeScale multiplies the half-life for one character', () => {
  const scaled = codex('affectBaseline: { v: 0, a: 0, d: 10 }\naffectHalfLifeScale: 2\n');
  withUniverse(worked({ 'codex/characters/emma.md': scaled }), (root) => {
    const oct8 = coords(root, '2026-10-08')!;
    assert.equal(oct8.halfLifeDays, 8);
    assert.deepEqual(oct8.coordinates, { valence: -46, arousal: 46, dominance: 33 });
  });
});

test('invalid codex affect fields are affect-malformed, and the character is not replayed', () => {
  const bad = [
    'affectBaseline: { v: 0, a: 0, d: 10 }\naffectHalfLifeScale: 0\n',
    'affectBaseline: { v: 0, a: 0, d: 10 }\naffectHalfLifeScale: -1\n',
    'affectBaseline: { v: 0, a: 0, d: 10 }\naffectHalfLifeScale: slow\n',
    'affectBaseline: serene\n',
    'affectBaseline: "curious → warm"\n',
  ];
  for (const fm of bad) {
    withUniverse(worked({ 'codex/characters/emma.md': codex(fm) }), (root) => {
      const linted = run(root, 'lint');
      assert.equal(linted.status, 1, fm);
      assert.match(linted.output, /\[affect-malformed\]/, fm);
      const { state, errors } = affectStateAt(root, 'Emma', '2026-10-08');
      assert.equal(state, undefined, fm);
      assert.equal(errors.length, 1, fm);
      assert.ok(run(root, 'context', 'Emma', '--as-of', '2026-10-08').output.includes('_Not computed:'), fm);
    });
  }
  // Checked with dynamics off too: a bad value fails when written.
  withUniverse(worked({ 'codex/characters/emma.md': codex('affectHalfLifeScale: 0\n') }, ''), (root) => {
    assert.equal(run(root, 'lint').status, 1);
  });
});

test('a chapter still running on --as-of is not applied', () => {
  const files = worked({ 'stories/01_book/chapters/03_three.md': ch(3, '2026-10-12 to 2026-10-14', 'curious → warm') });
  withUniverse(files, (root) => {
    assert.deepEqual(coords(root, '2026-10-13')!.events.map((e) => e.id), ['affect.event.emma.book1.ch2']);
    assert.deepEqual(coords(root, '2026-10-14')!.events.map((e) => e.id), ['affect.event.emma.book1.ch2', 'affect.event.emma.book1.ch3']);
  });
});

test('an event ending on the anchor date is already in the stretch', () => {
  const files = worked({ 'stories/01_book/chapters/02_two.md': ch(2, '2026-10-02', 'curious → angry') });
  withUniverse(files, (root) => {
    const oct8 = coords(root, '2026-10-08')!;
    assert.deepEqual(oct8.events, []);
  });
});

test('a later stretch that disagrees with the replay warns, and still re-anchors', () => {
  const files = worked({ 'stories/01_book/stretches/emma/2026-10-07.md': stretch('2026-10-07', 'stoic') });
  withUniverse(files, (root) => {
    const linted = run(root, 'lint');
    assert.match(linted.output, /\[affect-discontinuity\].*stretch\.emma\.book1\.2026-10-07 declares 0\/-20\/40/);
    const oct7 = coords(root, '2026-10-07')!;
    assert.equal(oct7.anchor.id, 'stretch.emma.book1.2026-10-07');
    assert.deepEqual(oct7.coordinates, { valence: 0, arousal: -20, dominance: 40 });
  });
});

test('a draft stretch neither anchors nor is checked', () => {
  const files = worked({ 'stories/01_book/stretches/emma/2026-10-07.md': stretch('2026-10-07', 'stoic', 'draft') });
  withUniverse(files, (root) => {
    assert.doesNotMatch(run(root, 'lint').output, /2026-10-07 declares/);
    assert.equal(coords(root, '2026-10-08')!.anchor.id, 'stretch.emma.book1.2026-10-02');
  });
});

test('context.affect: off prints no block', () => {
  withUniverse(worked({}, DYNAMICS + 'context:\n  affect: off\n'), (root) => {
    assert.ok(!run(root, 'context', 'Emma', '--as-of', '2026-10-08').output.includes('Affect state'));
  });
});
