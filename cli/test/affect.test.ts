/**
 * Character affect: declared in its own `affect:` field, never read out of a
 * voice register, and never scored from a label that did not resolve.
 *
 * The first affect engine mapped `private`/`public`/`under-pressure` to fixed
 * coordinates and parsed register parentheticals as transitions. On Supper
 * Club Secrets Book 1 every stretch got its register's numbers, 77 of 89
 * chapter events were scored from unknown labels as neutral, and `pinakes
 * context` prescribed "measured, steady" dialogue for a character in
 * performative chaos. These tests pin the replacement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAffectVocabulary,
  classifyAttractorBasin,
  formatAffectPromptInjection,
  getBehavioralDirectives,
  parseAffectDeclaration,
  resolveAffectLabel,
} from '@bbthorson/pinakes';
import { appendConfig, chapter, makeUniverse, cleanup, readJson, run, withUniverse, type Files } from './helpers.ts';

const LABELS = `affect:
  labels:
    angry: { v: -60, a: 60, d: 40 }
    relieved: { v: 40, a: -20, d: 10, aliases: [relief] }
`;

function stretch(extra = ''): string {
  return `---
character: Emma
asOf: "2026-10-01"
since: "2026-09-01"
register: private
status: approved
carrying:
  - "unpaid bills"
sources:
  - scene.book1.ch1
${extra}---
Looking back, the month was full of quiet questions.
`;
}

const STRETCH_PATH = 'stories/01_book/stretches/emma/2026-10-01.md';

/** A universe whose chapter has a register for Emma, so a stretch's `register: private` is in the vocabulary. */
function universe(files: Files, config = ''): string {
  const root = makeUniverse({
    'stories/01_book/chapters/01_one.md': chapter({
      num: 1,
      date: '2026-10-01',
      extra: 'registers:\n  Emma: "private (curious → quietly alarmed)"\n',
    }),
    ...files,
  });
  if (config) appendConfig(root, config);
  return root;
}

function withAffectUniverse(files: Files, config: string, fn: (root: string) => void): void {
  const root = universe(files, config);
  try {
    fn(root);
  } finally {
    cleanup(root);
  }
}

test('labels resolve exactly, and registers are not labels', () => {
  const vocab = buildAffectVocabulary({ angry: { v: -60, a: 60, d: 40 }, relieved: { v: 40, a: -20, d: 10, aliases: ['relief'] } });
  assert.ok(resolveAffectLabel('  Warm ', vocab));
  assert.equal(resolveAffectLabel('not warm', vocab), undefined, 'no substring fallback');
  assert.equal(resolveAffectLabel('furious', vocab), undefined, 'unknown is unknown, not neutral');
  for (const register of ['private', 'public', 'under-pressure', 'under_pressure']) {
    assert.equal(resolveAffectLabel(register, vocab), undefined, `${register} is a voice register`);
  }
  assert.deepEqual(resolveAffectLabel('relief', vocab), resolveAffectLabel('relieved', vocab));
  assert.deepEqual(resolveAffectLabel('angry', vocab), { valence: -0.6, arousal: 0.6, dominance: 0.4 });
});

test('the classifier returns no basin rather than defaulting to grounded-stoic', () => {
  assert.equal(classifyAttractorBasin({ valence: 0.1, arousal: -0.1, dominance: 0.2 }), 'grounded-stoic');
  assert.equal(classifyAttractorBasin({ valence: -0.5, arousal: 0.8, dominance: -0.1 }), 'hyper-vigilant');
  // High arousal, positive valence, modest dominance: nothing built in claims it.
  assert.equal(classifyAttractorBasin({ valence: 0.5, arousal: 0.4, dominance: 0.1 }), undefined);
  assert.notEqual(classifyAttractorBasin({ valence: 0.4, arousal: 0.6, dominance: 0.3 }), 'grounded-stoic');

  const basins = { buoyant: { when: { v: [20, 100] as [number, number], a: [36, 100] as [number, number] }, directives: ['Talks fast and laughs.'] } };
  assert.equal(classifyAttractorBasin({ valence: 0.5, arousal: 0.4, dominance: 0.1 }, basins), 'buoyant');
  assert.deepEqual(getBehavioralDirectives('buoyant', basins), ['Talks fast and laughs.']);
  // A built-in basin keeps its region even when a universe basin would also match.
  assert.equal(classifyAttractorBasin({ valence: 0.1, arousal: -0.1, dominance: 0.2 }, basins), 'grounded-stoic');
});

test('affect declarations: labels, transitions, triples, and what is malformed', () => {
  assert.deepEqual(parseAffectDeclaration('curious → angry'), { steps: ['curious', 'angry'] });
  assert.deepEqual(parseAffectDeclaration('curious -> angry (after the lie)'), { steps: ['curious', 'angry'] });
  assert.deepEqual(parseAffectDeclaration({ v: -40, a: -30, d: -50 }), { numeric: { valence: -0.4, arousal: -0.3, dominance: -0.5 } });

  const range = (raw: unknown) => {
    const d = parseAffectDeclaration(raw);
    return 'problem' in d ? d.problem.rule : undefined;
  };
  assert.equal(range({ v: 140, a: 0, d: 0 }), 'affect-out-of-range');
  assert.equal(range({ v: 1.5, a: 0, d: 0 }), 'affect-out-of-range');
  assert.equal(range({ v: 10, a: 0 }), 'affect-malformed');
  assert.equal(range(['angry']), 'affect-malformed');
  assert.equal(range(''), 'affect-malformed');
});

test('the prompt block is advisory and does not repeat carrying', () => {
  const block = formatAffectPromptInjection({
    coordinates: { valence: -65, arousal: 82, dominance: -40 },
    attractorBasin: 'hyper-vigilant',
    behavioralDirectives: ['Scan exits'],
  });
  assert.ok(block.includes('Valence=-0.65 | Arousal=0.82 | Dominance=-0.40'));
  assert.ok(block.includes('SUGGESTED_TENDENCIES:\n  - Scan exits'));
  assert.ok(!block.includes('BEHAVIORAL_CONSTRAINTS'));
  assert.ok(!block.includes('ACTIVE_TENSIONS'));
  assert.ok(!block.includes('Baseline'));
});

test('undeclared affect compiles to nothing: no events, no stretch coordinates, no context block', () => {
  withAffectUniverse({ [STRETCH_PATH]: stretch() }, '', (root) => {
    const compiled = run(root, 'compile');
    assert.equal(compiled.status, 0, compiled.output);
    assert.ok(!fs.existsSync(path.join(root, 'records/book1/character_affect_events.json')));

    const [s] = readJson(root, 'records/book1/character_stretches.json');
    assert.equal(s.register, 'private');
    assert.equal(s.coordinates, undefined);
    assert.equal(s.attractorBasin, undefined);
    assert.equal(s.behavioralDirectives, undefined);

    const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-01');
    assert.equal(ctx.status, 0, ctx.output);
    assert.ok(!ctx.output.includes('Affect state'), ctx.output);
    assert.ok(!ctx.output.includes('INTERNAL_AFFECT_STATE'));

    const linted = run(root, 'lint');
    assert.equal(linted.status, 0, linted.output);
  });
});

test('a declared chapter transition emits one event with the right signs', () => {
  const ch = chapter({
    num: 1,
    date: '2026-10-01',
    extra: 'rpe: 50\nregisters:\n  Emma: "under-pressure (asks the right questions, then lashes out)"\naffect:\n  Emma: "curious → angry"\n',
  });
  withAffectUniverse({ 'stories/01_book/chapters/01_one.md': ch }, LABELS, (root) => {
    const compiled = run(root, 'compile');
    assert.equal(compiled.status, 0, compiled.output);
    const events = readJson(root, 'records/book1/character_affect_events.json');
    assert.equal(events.length, 1);
    const [e] = events;
    assert.equal(e.subject, 'char.emma');
    assert.equal(e.register, 'under-pressure');
    assert.ok(e.delta.valence < 0 && e.delta.arousal > 0 && e.delta.dominance > 0, JSON.stringify(e.delta));
    // A chapter-wide `rpe:` would stamp one surprise on every character in it.
    assert.equal(e.rpe, undefined, 'rpe is not part of the record');
    assert.equal(run(root, 'lint').status, 0);
  });
});

test('a middle step is recorded in the stimulus; the delta runs first to last', () => {
  const ch = chapter({
    num: 1,
    date: '2026-10-01',
    extra: 'beat_purpose: "The reveal"\nregisters:\n  Emma: private\naffect:\n  Emma: "curious → guarded → angry"\n',
  });
  withAffectUniverse({ 'stories/01_book/chapters/01_one.md': ch }, LABELS, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const [e] = readJson(root, 'records/book1/character_affect_events.json');
    assert.equal(e.stimulus, 'The reveal (via guarded)');
    assert.deepEqual(e.delta, { valence: -100, arousal: 30, dominance: 20 });
  });
});

test('an unresolved chapter label warns and emits no event', () => {
  const ch = chapter({ num: 1, date: '2026-10-01', extra: 'registers:\n  Emma: private\naffect:\n  Emma: "curious → furious"\n' });
  withAffectUniverse({ 'stories/01_book/chapters/01_one.md': ch }, LABELS, (root) => {
    const linted = run(root, 'lint');
    assert.equal(linted.status, 0, 'a chapter label is a warning by default');
    assert.match(linted.output, /\[affect-label-unresolved\].*'furious'/);
    assert.equal(run(root, 'compile').status, 0);
    assert.ok(!fs.existsSync(path.join(root, 'records/book1/character_affect_events.json')));
  });
});

test('chapter affect problems: one label, out of range, unknown character, no register', () => {
  const cases: [string, RegExp, number][] = [
    ['affect:\n  Emma: angry\n', /\[affect-malformed\].*transition/, 1],
    ['affect:\n  Emma: { v: 140, a: 0, d: 0 }\n', /\[affect-out-of-range\]/, 1],
    ['registers:\n  Emma: private\naffect:\n  Nobody: "curious → angry"\n', /\[unresolved-entities\].*affect keys/, 1],
    ['affect:\n  Emma: "curious → angry"\n', /\[affect-declared-no-register\]/, 0],
  ];
  for (const [extra, expected, status] of cases) {
    const ch = chapter({ num: 1, date: '2026-10-01', extra });
    withAffectUniverse({ 'stories/01_book/chapters/01_one.md': ch }, LABELS, (root) => {
      const linted = run(root, 'lint');
      assert.match(linted.output, expected, extra);
      assert.equal(linted.status, status, `${extra}\n${linted.output}`);
    });
  }
});

test('a declared stretch label compiles to coordinates, a basin, and an advisory context block', () => {
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: relieved\n') }, LABELS, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const [s] = readJson(root, 'records/book1/character_stretches.json');
    assert.deepEqual(s.coordinates, { valence: 40, arousal: -20, dominance: 10 });
    assert.equal(s.attractorBasin, 'grounded-stoic');
    assert.ok(s.behavioralDirectives.length > 0);

    const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-01');
    assert.equal(ctx.status, 0, ctx.output);
    assert.ok(ctx.output.includes('## Affect state (advisory — the voice guide and register win on any conflict)'), ctx.output);
    assert.ok(ctx.output.includes('SUGGESTED_TENDENCIES'));
    assert.ok(!ctx.output.includes('ACTIVE_TENSIONS'));
    assert.equal(run(root, 'lint').status, 0);
  });
});

test('a numeric stretch triple in high arousal is not grounded-stoic', () => {
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: { v: 40, a: 60, d: 30 }\n') }, '', (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const [s] = readJson(root, 'records/book1/character_stretches.json');
    assert.deepEqual(s.coordinates, { valence: 40, arousal: 60, dominance: 30 });
    assert.notEqual(s.attractorBasin, 'grounded-stoic');
  });
});

test('an unresolved stretch label is an error, and `not warm` is not `warm`', () => {
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: not warm\n') }, '', (root) => {
    const linted = run(root, 'lint');
    assert.equal(linted.status, 1, linted.output);
    assert.match(linted.output, /\[stretch-affect-unresolved\].*'not warm'/);
    run(root, 'compile');
    const [s] = readJson(root, 'records/book1/character_stretches.json');
    assert.equal(s.coordinates, undefined);
  });
});

test('a stretch transition is malformed: a stretch is a state', () => {
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: "curious → warm"\n') }, '', (root) => {
    const linted = run(root, 'lint');
    assert.equal(linted.status, 1);
    assert.match(linted.output, /\[affect-malformed\].*a state/);
  });
});

test('context.affect: off silences a declared stretch', () => {
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: warm\n') }, 'context:\n  affect: off\n', (root) => {
    const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-01');
    assert.equal(ctx.status, 0, ctx.output);
    assert.ok(!ctx.output.includes('Affect state'));
  });
});

test('a universe basin claims what the built-ins leave, with its own directives', () => {
  const config = `affect:
  basins:
    buoyant:
      when: { v: [20, 100], a: [36, 100] }
      directives: ["Talks fast and laughs at their own jokes."]
    grounded-stoic:
      directives: ["Says less than they know."]
`;
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: { v: 50, a: 40, d: 10 }\n') }, config, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const [s] = readJson(root, 'records/book1/character_stretches.json');
    assert.equal(s.attractorBasin, 'buoyant');
    assert.deepEqual(s.behavioralDirectives, ['Talks fast and laughs at their own jokes.']);
  });
  withAffectUniverse({ [STRETCH_PATH]: stretch('affect: warm\n') }, config, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const [s] = readJson(root, 'records/book1/character_stretches.json');
    assert.deepEqual(s.behavioralDirectives, ['Says less than they know.']);
  });
});

test('an affect config that would make a label ambiguous is rejected', () => {
  const bad = [
    'affect:\n  labels:\n    angry: { v: -60, a: 60, d: 40, aliases: [warm] }\n',
    'affect:\n  labels:\n    angry: { v: -60, a: 60, d: 40 }\n    cross: { v: -50, a: 50, d: 30, aliases: [angry] }\n',
    'affect:\n  basins:\n    grounded-stoic:\n      when: { a: [0, 10] }\n',
    'affect:\n  basins:\n    buoyant:\n      directives: ["x"]\n',
    'affect:\n  labels:\n    angry: { v: -600, a: 60, d: 40 }\n',
  ];
  for (const config of bad) {
    withUniverse({}, (root) => {
      appendConfig(root, config);
      assert.notEqual(run(root, 'lint').status, 0, config);
    });
  }
});
