/**
 * Mathematical dynamical system tests for character affect.
 *
 * Verifies two-timescale relaxation, allostatic baseline adaptation,
 * reward prediction error (RPE) modulation, attractor basin classification,
 * register delta parsing, and Lexicon compilation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clip,
  toScaledInt,
  fromScaledInt,
  scaleVad,
  unscaleVad,
  relaxAffect,
  adaptBaseline,
  applyEpisodicShock,
  classifyAttractorBasin,
  getBehavioralDirectives,
  parseAffectTransition,
  calculateRegisterDelta,
  formatAffectPromptInjection,
  resolveRegisterVad,
} from '../src/compiler/affect.ts';
import { readJson, run, withUniverse } from './helpers.ts';

test('coordinate scaling and clamping', () => {
  assert.equal(clip(1.5), 1.0);
  assert.equal(clip(-1.5), -1.0);
  assert.equal(clip(0.35), 0.35);

  assert.equal(toScaledInt(0.456), 46);
  assert.equal(toScaledInt(-0.789), -79);
  assert.equal(toScaledInt(1.2), 100);
  assert.equal(toScaledInt(-1.2), -100);

  assert.equal(fromScaledInt(46), 0.46);
  assert.equal(fromScaledInt(-79), -0.79);

  const vad = { valence: 0.25, arousal: -0.5, dominance: 0.75 };
  const scaled = scaleVad(vad);
  assert.deepEqual(scaled, { valence: 25, arousal: -50, dominance: 75 });
  assert.deepEqual(unscaleVad(scaled), vad);
});

test('two-timescale homeostatic relaxation', () => {
  const current = { valence: -0.8, arousal: 0.9, dominance: -0.4 };
  const baseline = { valence: 0.1, arousal: -0.1, dominance: 0.1 };

  // Delta 0 days -> no change
  const relaxed0 = relaxAffect(current, baseline, 0);
  assert.deepEqual(relaxed0, current);

  // Delta 5 days -> exponential decay toward baseline
  const relaxed5 = relaxAffect(current, baseline, 5, 0.15);
  assert.ok(relaxed5.valence > current.valence, 'valence should relax toward baseline');
  assert.ok(relaxed5.arousal < current.arousal, 'arousal should relax toward baseline');
  assert.ok(relaxed5.dominance > current.dominance, 'dominance should relax toward baseline');

  // Infinite/large time -> relaxes to baseline
  const relaxedInf = relaxAffect(current, baseline, 100, 0.15);
  assert.ok(Math.abs(relaxedInf.valence - baseline.valence) < 0.001);
  assert.ok(Math.abs(relaxedInf.arousal - baseline.arousal) < 0.001);
  assert.ok(Math.abs(relaxedInf.dominance - baseline.dominance) < 0.001);
});

test('allostatic baseline adaptation under sustained affect', () => {
  const current = { valence: -0.7, arousal: 0.6, dominance: -0.5 };
  const baseline = { valence: 0.0, arousal: 0.0, dominance: 0.0 };

  const adapted = adaptBaseline(current, baseline, 10, 0.03);
  // Baseline should drag toward the sustained negative state
  assert.ok(adapted.valence < 0.0, 'baseline valence should drag negative');
  assert.ok(adapted.arousal > 0.0, 'baseline arousal should elevate');
  assert.ok(adapted.dominance < 0.0, 'baseline dominance should drag negative');
});

test('episodic shocks and RPE modulation', () => {
  const current = { valence: 0.0, arousal: 0.0, dominance: 0.0 };
  const impulse = { valence: -0.2, arousal: 0.3, dominance: -0.1 };

  // Neutral RPE
  const shock0 = applyEpisodicShock(current, impulse, 0.0);
  assert.equal(shock0.valence, -0.2);
  assert.equal(shock0.arousal, 0.3);
  assert.equal(shock0.dominance, -0.1);

  // Severe negative prediction error (ambush / betrayal) -> RPE = -1.5
  // Should crash valence, spike arousal, suppress dominance
  const shockNeg = applyEpisodicShock(current, impulse, -1.5);
  assert.ok(shockNeg.valence < shock0.valence, 'negative RPE crashes valence');
  assert.ok(shockNeg.arousal > shock0.arousal, 'negative RPE spikes arousal');
  assert.ok(shockNeg.dominance < shock0.dominance, 'negative RPE suppresses dominance');

  // Positive prediction error (unexpected windfall / relief) -> RPE = +1.5
  const shockPos = applyEpisodicShock(current, impulse, 1.5);
  assert.ok(shockPos.valence > shock0.valence, 'positive RPE elevates valence');
  assert.ok(shockPos.dominance > shock0.dominance, 'positive RPE elevates dominance');
});

test('attractor basin classification and behavioral directives', () => {
  // Hyper-vigilant: high arousal + dysphoria
  const hvBasin = classifyAttractorBasin({ valence: -0.5, arousal: 0.8, dominance: -0.1 });
  assert.equal(hvBasin, 'hyper-vigilant');
  assert.ok(getBehavioralDirectives(hvBasin).some((d) => d.includes('cadence must be rapid')));

  // Depressive-exhaustion: low arousal + low valence + low dominance
  const deBasin = classifyAttractorBasin({ valence: -0.6, arousal: -0.5, dominance: -0.4 });
  assert.equal(deBasin, 'depressive-exhaustion');
  assert.ok(getBehavioralDirectives(deBasin).some((d) => d.includes('cadence must be sparse')));

  // Manic-fixation: high arousal + high dominance + intense affect
  const mfBasin = classifyAttractorBasin({ valence: 0.6, arousal: 0.7, dominance: 0.5 });
  assert.equal(mfBasin, 'manic-fixation');
  assert.ok(getBehavioralDirectives(mfBasin).some((d) => d.includes('cadence is intense')));

  // Dissociative-numb: severe hypo-arousal + blunted valence + suppressed dominance
  const dnBasin = classifyAttractorBasin({ valence: 0.05, arousal: -0.7, dominance: -0.5 });
  assert.equal(dnBasin, 'dissociative-numb');
  assert.ok(getBehavioralDirectives(dnBasin).some((d) => d.includes('cadence is mechanical')));

  // Grounded-stoic: homeostatic
  const gsBasin = classifyAttractorBasin({ valence: 0.1, arousal: -0.1, dominance: 0.2 });
  assert.equal(gsBasin, 'grounded-stoic');
  assert.ok(getBehavioralDirectives(gsBasin).some((d) => d.includes('cadence is measured')));
});

test('register parsing and delta calculation', () => {
  // Inner paren transition
  const t1 = parseAffectTransition('private (curious → quietly alarmed)');
  assert.equal(t1.fromRegister, 'curious');
  assert.equal(t1.toRegister, 'quietly alarmed');

  const delta1 = calculateRegisterDelta(t1.fromRegister, t1.toRegister);
  assert.ok(delta1.valence < 0, 'valence should drop going from curious to quietly alarmed');
  assert.ok(delta1.arousal > 0, 'arousal should increase');

  // Outer arrow transition
  const t2 = parseAffectTransition('public → private (hostess softening)');
  assert.equal(t2.fromRegister, 'public');
  assert.equal(t2.toRegister, 'private');
  assert.equal(t2.note, 'hostess softening');

  // Single step with note
  const t3 = parseAffectTransition('public (warm)');
  assert.equal(t3.fromRegister, 'public');
  assert.equal(t3.toRegister, 'warm');
});

test('prompt injection formatting', () => {
  const block = formatAffectPromptInjection({
    coordinates: { valence: -65, arousal: 82, dominance: -40, baselineValence: -20 },
    attractorBasin: 'hyper-vigilant',
    openTensions: ['Believes copilot compromised', 'Sleep-deprived'],
    behavioralDirectives: ['Dialogue cadence must be curt', 'Scan exits'],
  });

  assert.ok(block.startsWith('[INTERNAL_AFFECT_STATE]'));
  assert.ok(block.includes('Valence=-0.65'));
  assert.ok(block.includes('Arousal=0.82'));
  assert.ok(block.includes('ATTRACTOR: hyper-vigilant'));
  assert.ok(block.includes('- "Believes copilot compromised"'));
  assert.ok(block.includes('- Dialogue cadence must be curt'));
  assert.ok(block.endsWith('[/INTERNAL_AFFECT_STATE]'));
});

test('compilation emits character_affect_events and decorates character_stretches with affect state', () => {
  const chapter = `---
chapter: 1
title: The Shock
date: "2026-10-04"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
registers:
  Emma: "private (curious → quietly alarmed)"
---
Emma looked at the table.
`;

  const stretch = `---
character: Emma
asOf: "2026-10-04"
since: "2026-09-01"
register: private
status: approved
carrying:
  - "unpaid bills"
  - "missing key"
sources:
  - char.emma
---
Looking back, the month was full of quiet questions.
`;

  withUniverse(
    {
      'stories/01_book/chapters/01_one.md': chapter,
      'stories/01_book/stretches/emma/2026-10-04.md': stretch,
    },
    (root) => {
      const compiled = run(root, 'compile');
      assert.equal(compiled.status, 0, compiled.output);

      // Verify affect events written and valid
      const events = readJson(root, 'records/book1/character_affect_events.json');
      assert.equal(events.length, 1);
      assert.equal(events[0].$type, 'test.universe.character.affect.event');
      assert.equal(events[0].subject, 'char.emma');
      assert.ok(events[0].delta.valence < 0);

      // Verify stretch record is decorated with affect coordinates and attractor basin
      const stretches = readJson(root, 'records/book1/character_stretches.json');
      assert.equal(stretches.length, 1);
      assert.equal(stretches[0].$type, 'test.universe.character.stretch');
      assert.equal(stretches[0].subject, 'char.emma');
      assert.equal(stretches[0].attractorBasin, 'grounded-stoic');
      assert.deepEqual(stretches[0].coordinates, {
        valence: 10,
        arousal: -10,
        dominance: 10,
        baselineValence: 10,
      });
      assert.ok(Array.isArray(stretches[0].behavioralDirectives));
      assert.ok(stretches[0].behavioralDirectives.length > 0);

      // Verify context command injects the affect prompt block
      const ctx = run(root, 'context', 'Emma', '--as-of', '2026-10-04');
      assert.equal(ctx.status, 0, ctx.output);
      assert.ok(ctx.output.includes('[INTERNAL_AFFECT_STATE]'));
      assert.ok(ctx.output.includes('ATTRACTOR: grounded-stoic'));
      assert.ok(ctx.output.includes('unpaid bills'));
    }
  );
});
