/**
 * Probabilistic writing & editorial layer tests:
 * 1. Guest / book-scoped character stubs in `pinakes context`
 * 2. First-Appearance Entity Ledger compilation & before-chapter filtering
 * 3. Scene-Mode 3-Move Character Brief firewall & pre-sampling `doNotReveal` mask
 * 4. DecisionScorer (Cloudflare Clef / Jev-API + Mock) & SHA-256 seeded sampler
 * 5. POV-locked Single Narrator Pen Handoff (`pinakes compose`)
 * 6. Six-Lens Temporal Review Board slices, Clef escalation pre-pass, and precedence merge
 * 7. JSONL calibration harness (`pinakes calibrate`)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chapter, readJson, run, withUniverse } from './helpers.ts';
import * as pinakes from '@bbthorson/pinakes';

const CH1 = 'stories/01_book/chapters/01_one.md';
const CH2 = 'stories/01_book/chapters/02_two.md';
const CH3 = 'stories/01_book/chapters/03_three.md';

const GUEST_REGISTRY = `characters:
  - id: char.emma
    type: character
    displayName: Emma
  - id: char.leo
    type: character
    displayName: Leo
  - id: char.marta
    type: character
    displayName: Marta Diaz
    aliases: [Marta, Mrs. Diaz]
places:
  - id: place.bar
    type: place
    displayName: The Bar
items:
  - id: item.key
    type: item
    displayName: Key
`;

describe('1. Guest / book-scoped character stubs in context', () => {
  test('populates Long tier from stories/<book>/characters/<slug>.md with identical stripping rules', () => {
    const cfg = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
context:
  codex:
    include: [Overview, Voice]
    exclude:
      Marta Diaz: [Secret Agenda]
    excludeParagraphs: ["SPOILER:"]
`;
    const stub = `---
id: char.marta
role: neighbor
---
# Marta Diaz

## Overview
A sharp-eyed neighbor on the third floor.

SPOILER: She secretly owns the building.

### Secret Agenda
Never reveal this to Scene Mode.

## Voice
Brisk, practical, never wastes a word. In Chapter 3 she calls the inspector.
`;
    const files = {
      'pinakes.yaml': cfg,
      'codex/entities.yaml': GUEST_REGISTRY,
      [CH1]: chapter({ num: 1, date: '2026-10-01', extra: 'characters_present: [Emma, Marta Diaz]\n' }),
      [CH3]: chapter({ num: 3, date: '2026-10-15', extra: 'characters_present: [Emma, Marta Diaz]\n' }),
      'stories/01_book/characters/marta.md': stub,
    };

    withUniverse(files, (root) => {
      const { bundle, errors } = pinakes.context(root, 'Marta Diaz', '2026-10-02');
      assert.deepEqual(errors, []);
      assert.ok(bundle);
      assert.equal(bundle.long.sourceScope, 'book');
      assert.equal(bundle.long.sourceFile, 'stories/01_book/characters/marta.md');

      const rendered = pinakes.renderContextMarkdown(bundle);
      assert.match(rendered, /sharp-eyed neighbor/);
      // Excluded subsection, excluded paragraph prefix, and future-chapter paragraph must all be stripped.
      assert.doesNotMatch(rendered, /Never reveal this/);
      assert.doesNotMatch(rendered, /secretly owns the building/);
      assert.doesNotMatch(rendered, /calls the inspector/);
      assert.equal(bundle.long.withheld, 3);
    });
  });

  test('CLI context --story disambiguates when two books define stubs for the same guest character', () => {
    const cfg = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
context:
  codex:
    include: [Overview]
`;
    const files = {
      'pinakes.yaml': cfg,
      'codex/entities.yaml': GUEST_REGISTRY,
      [CH1]: chapter({ num: 1, date: '2026-10-01' }),
      'stories/02_sequel/chapters/01_one.md': chapter({ num: 1, date: '2026-11-01' }),
      'stories/01_book/characters/marta.md': '# Marta\n\n## Overview\nFirst-story stub.\n',
      'stories/02_sequel/characters/marta.md': '# Marta\n\n## Overview\nSequel-story stub.\n',
    };

    withUniverse(files, (root) => {
      const res = run(root, 'context', 'Marta', '--as-of', '2026-12-01', '--story', 'book2');
      assert.equal(res.status, 0, res.output);
      assert.match(res.output, /Sequel-story stub/);
      assert.doesNotMatch(res.output, /First-story stub/);
    });
  });
});

describe('2. First-Appearance Entity Ledger', () => {
  test('compile emits entity_first_appearances.json and filterLedgerBeforeChapter enforces ch - 1 cutoff', () => {
    const files = {
      'codex/entities.yaml': GUEST_REGISTRY,
      [CH1]: `---
chapter: 1
title: "One"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
Emma wiped the counter at The Bar.
`,
      [CH2]: `---
chapter: 2
title: "Two"
date: "2026-10-02"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Marta Diaz]
---
"Morning," said Mrs. Diaz from the doorway.
`,
    };

    withUniverse(files, (root) => {
      const comp = run(root, 'compile');
      assert.equal(comp.status, 0, comp.output);
      const ledger = readJson(root, 'records/series/entity_first_appearances.json');
      const marta = ledger.find((e) => e.id === 'char.marta');
      assert.ok(marta);
      assert.equal(marta.firstPresent.chapter, 2);
      assert.equal(marta.firstNamedOnPage.chapter, 2);
      assert.equal(marta.firstNamedOnPage.matchedForm, 'Mrs. Diaz');

      // Before chapter 2, Marta has NOT been named on-page yet.
      const beforeCh2 = pinakes.filterLedgerBeforeChapter(ledger as pinakes.EntityFirstAppearance[], 'book1', 2);
      assert.equal(beforeCh2.find((e) => e.id === 'char.marta'), undefined);
      assert.ok(beforeCh2.find((e) => e.id === 'char.emma'));
    });
  });
});

describe('3. Scene-Mode 3-Move Brief Firewall, Hard Constraint Mask & Seeded Sampler', () => {
  const sampleBriefObj: pinakes.CharacterBrief = {
    character: 'Marta Diaz',
    asOf: '2026-10-02',
    book: 'book1',
    chapter: 2,
    beatType: 'plot-pivot',
    moves: [
      {
        id: 'A',
        tactic: 'Volunteer building gossip including the energy audits.',
        notice: 'Emma looks tired.',
        say: 'Did you hear about the energy audits starting next week?',
        holdBack: 'She saw the landlord leave late.',
        physicalTell: 'Taps her umbrella twice.',
      },
      {
        id: 'B',
        tactic: 'Ask a practical question about the water heater.',
        notice: 'Steam near the pipes.',
        say: 'Is the boiler rattling again on your floor?',
        holdBack: 'She already called the super.',
        physicalTell: 'Tilts her head toward the hallway.',
      },
      {
        id: 'C',
        tactic: 'Keep it brief and head upstairs.',
        notice: 'Mail stacked on the table.',
        say: 'Just grabbing my parcel. Goodnight.',
        holdBack: 'She noticed an unfamiliar envelope.',
        physicalTell: 'Shifts her grocery bag to her left hip.',
      },
    ],
  };

  test('briefBundles enforces Scene-Mode firewall (never includes fullState annotations)', () => {
    const files = {
      'codex/entities.yaml': GUEST_REGISTRY,
      [CH1]: chapter({
        num: 1,
        date: '2026-10-01',
        extra: 'registers:\n  Emma: "public (OMNISCIENT AUTHOR SECRET ABOUT CH 9)"\n',
      }),
    };

    withUniverse(files, (root) => {
      const { bundles, errors } = pinakes.briefBundles(root, {
        story: '01_book',
        chapter: 1,
        asOf: '2026-10-01',
        characters: ['Emma'],
        sceneSetup: 'Emma opens the door.',
      });
      assert.deepEqual(errors, []);
      assert.equal(bundles.length, 1);
      assert.equal(bundles[0].context.fullState, false);
      assert.doesNotMatch(bundles[0].contextMarkdown, /OMNISCIENT AUTHOR SECRET/);
    });
  });

  test('briefRouting selects model and reasoningEffort by basin, scope, and beatType and logs them in SampleRollLog', () => {
    const cfg = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
context:
  codex:
    include: [Overview]
probabilistic:
  briefRouting:
    default:
      model: claude-opus-4-6
      reasoningEffort: medium
    rules:
      - name: system-1-exhausted
        when:
          basin: [depressive-exhaustion, hyper-vigilant]
        reasoningEffort: none
      - name: guest-banter
        when:
          scope: guest
          beatType: banter
        model: claude-haiku-4-5
        reasoningEffort: none
`;
    const files = {
      'pinakes.yaml': cfg,
      'codex/entities.yaml': GUEST_REGISTRY.replace(
        'displayName: Emma',
        'displayName: Emma\n    sourceFile: codex/characters/emma.md'
      ),
      'codex/characters/emma.md': '# Emma\n\n## Overview\nMain cast.\n',
      'stories/01_book/characters/marta.md': '# Marta\n\n## Overview\nGuest neighbor.\n',
      [CH1]: chapter({ num: 1, date: '2026-10-01', extra: 'characters_present: [Emma, Marta Diaz]\n' }),
    };

    withUniverse(files, (root) => {
      const { bundles, errors } = pinakes.briefBundles(root, {
        story: '01_book',
        chapter: 1,
        asOf: '2026-10-01',
        characters: ['Emma', 'Marta Diaz'],
        sceneSetup: 'Quick hallway banter.',
        beatType: 'banter',
      });
      assert.deepEqual(errors, []);
      const emma = bundles.find((b) => b.character.id === 'char.emma')!;
      const marta = bundles.find((b) => b.character.id === 'char.marta')!;
      assert.equal(emma.route.model, 'claude-opus-4-6');
      assert.equal(emma.route.reasoningEffort, 'medium');
      assert.equal(marta.route.model, 'claude-haiku-4-5');
      assert.equal(marta.route.reasoningEffort, 'none');
      assert.equal(marta.route.matchedRule, 'guest-banter');
      assert.match(pinakes.renderCharacterBriefPrompt(marta), /claude-haiku-4-5/);

      const u = pinakes.openUniverse(root);
      const exhaustedRoute = pinakes.resolveBriefRoute(u.config, {
        characterId: 'char.emma',
        characterName: 'Emma',
        basin: 'depressive-exhaustion',
        scope: 'main',
      });
      assert.equal(exhaustedRoute.model, 'claude-opus-4-6');
      assert.equal(exhaustedRoute.reasoningEffort, 'none');
      assert.equal(exhaustedRoute.matchedRule, 'system-1-exhausted');

      const rolled = pinakes.sampleCharacterMove(
        { ...sampleBriefObj, briefModel: 'claude-haiku-4-5', reasoningEffort: 'none' },
        { rawProbs: { A: 0.5, B: 0.3, C: 0.2 } }
      );
      assert.equal(rolled.log?.briefModel, 'claude-haiku-4-5');
      assert.equal(rolled.log?.reasoningEffort, 'none');
    });
  });

  test('pre-sampling hard constraint mask zeroes out moves violating doNotReveal before sampling', async () => {
    const cfg = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
probabilistic:
  sampling:
    floor: 0.08
    temperature: 0.85
    beatTemperatures:
      plot-pivot: 0.6
  doNotReveal:
    - id: energy-audits
      description: "Energy audits clue is held until Chapter 4."
      terms: ["energy audits"]
      holdUntil:
        book: book1
        chapter: 4
`;
    const files = {
      'pinakes.yaml': cfg,
      'codex/entities.yaml': GUEST_REGISTRY,
      [CH1]: chapter({ num: 1, date: '2026-10-01' }),
    };

    await new Promise<void>((resolve, reject) => {
      withUniverse(files, (root) => {
        // Even with 0.99 raw probability on Move A, the pre-sampling mask must zero it out.
        pinakes
          .sampleBrief(root, sampleBriefObj, {
            rawProbs: { A: 0.99, B: 0.006, C: 0.004 },
          })
          .then((outcome) => {
            assert.equal(outcome.ok, true);
            assert.ok(outcome.log);
            assert.deepEqual(outcome.log.maskedMoves, ['A']);
            assert.equal(outcome.log.adjustedProbs.A, 0);
            assert.notEqual(outcome.log.chosenMoveId, 'A');
            assert.equal(outcome.log.temperature, 0.6); // beatType override applied
            resolve();
          })
          .catch(reject);
      });
    });
  });

  test('seeded sampler is deterministic, supports reroll, and applies plausibility floor', () => {
    const first = pinakes.sampleCharacterMove(sampleBriefObj, {
      rawProbs: { A: 0.6, B: 0.35, C: 0.05 }, // C < 0.08 floor => dropped
      floor: 0.08,
      temperature: 0.85,
    });
    const second = pinakes.sampleCharacterMove(sampleBriefObj, {
      rawProbs: { A: 0.6, B: 0.35, C: 0.05 },
      floor: 0.08,
      temperature: 0.85,
    });
    assert.equal(first.ok, true);
    assert.deepEqual(first.log, second.log);
    assert.deepEqual(first.log?.floorDroppedMoves, ['C']);
    assert.equal(first.log?.adjustedProbs.C, 0);

    const rerolled = pinakes.sampleCharacterMove(sampleBriefObj, {
      rawProbs: { A: 0.6, B: 0.35, C: 0.05 },
      floor: 0.08,
      temperature: 0.85,
      reroll: 1,
    });
    assert.notEqual(rerolled.log?.seedHash, first.log?.seedHash);
    assert.match(rerolled.log?.seedInput ?? '', /:1$/);
  });

  test('CloudflareClefScorer batches move choice + semantic doNotReveal gates in one pass', async () => {
    let capturedBody: any;
    const fakeFetch: typeof fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(
        JSON.stringify({
          result: {
            answers: [
              { id: 'move_choice', probabilities: { A: 0.7, B: 0.2, C: 0.1 } },
              { id: 'mask:A:energy-audits', probabilities: { yes: 0.92, no: 0.08 } },
              { id: 'mask:B:energy-audits', probabilities: { yes: 0.04, no: 0.96 } },
              { id: 'mask:C:energy-audits', probabilities: { yes: 0.02, no: 0.98 } },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const scorer = new pinakes.CloudflareClefScorer({
      model: '@cf/cloudflare/clef',
      accountId: 'test-acct',
      apiToken: 'test-token',
      fetchImpl: fakeFetch,
    });

    const scored = await pinakes.scoreBriefWithScorer(scorer, sampleBriefObj, {
      contextMarkdown: '# Marta Diaz',
      sceneSetup: 'Hallway encounter.',
      constraints: [
        {
          id: 'energy-audits',
          description: 'Do not reveal energy audits before Ch 4.',
          terms: [],
          patterns: [],
          holdUntil: { book: 'book1', chapter: 4 },
          checkFields: ['say', 'tactic', 'physicalTell'],
        },
      ],
    });

    assert.equal(capturedBody.questions.length, 4);
    assert.ok(Math.abs(scored.rawProbs.A - 0.7) < 1e-9);
    assert.equal(scored.semanticMask.A?.masked, true);
    assert.equal(scored.semanticMask.B, undefined);
  });
});

describe('4. Single Narrator Pen Handoff (POV-lock enforcement)', () => {
  test('strips notice, holdBack, and tactic from non-POV characters in code', () => {
    withUniverse({ 'writing_guide.md': 'Keep dialogue crisp.' }, (root) => {
      const { bundle, errors } = pinakes.composeNarrator(root, {
        book: 'book1',
        chapter: 2,
        asOf: '2026-10-02',
        povCharacter: 'Emma',
        sceneSetup: 'Emma meets Marta by the stairs.',
        writingGuidePath: 'writing_guide.md',
        winningMoves: [
          {
            character: 'Emma',
            move: {
              id: 'A',
              tactic: 'Deflect politely',
              notice: 'Marta is clutching a folded notice.',
              say: 'Long day?',
              holdBack: 'Emma already knows about the pipe leak.',
              physicalTell: 'Rests a hand on the banister.',
            },
          },
          {
            character: 'Marta',
            move: {
              id: 'B',
              tactic: 'SECRET_NON_POV_TACTIC',
              notice: 'SECRET_NON_POV_NOTICE',
              say: 'Just grabbing my mail.',
              holdBack: 'SECRET_NON_POV_HOLDBACK',
              physicalTell: 'Shifts her grocery bag.',
            },
          },
        ],
      });

      assert.deepEqual(errors, []);
      assert.ok(bundle);
      assert.equal(bundle.pov.holdBack, 'Emma already knows about the pipe leak.');
      assert.equal(bundle.others.length, 1);
      assert.deepEqual(Object.keys(bundle.others[0]).sort(), ['character', 'physicalTell', 'say']);

      const json = JSON.stringify(bundle);
      const md = pinakes.renderNarratorBundleMarkdown(bundle);
      for (const forbidden of ['SECRET_NON_POV_TACTIC', 'SECRET_NON_POV_NOTICE', 'SECRET_NON_POV_HOLDBACK']) {
        assert.equal(json.includes(forbidden), false, `JSON leaked ${forbidden}`);
        assert.equal(md.includes(forbidden), false, `Markdown leaked ${forbidden}`);
      }
      assert.match(md, /Keep dialogue crisp/);
    });
  });
});

describe('5. Six-Lens Temporal Review Board & Probabilistic Lint Pre-Pass', () => {
  test('assembles all 6 distinct lenses with First-Appearance Ledger on backward-mid and interiority on forward-mid', () => {
    const cfg = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
probabilistic:
  review:
    priorChapters: 1
    paths:
      writingGuide: guides/writing.md
      voiceGuide: guides/voice.md
      seriesPlan: codex/series_plan.md
`;
    const files = {
      'pinakes.yaml': cfg,
      'codex/entities.yaml': GUEST_REGISTRY,
      'guides/writing.md': 'No melodrama.',
      'guides/voice.md': 'Dry warmth.',
      'codex/series_plan.md': 'Book 3 resolves the overarching mystery.',
      'stories/01_book/plot/outline.md': '## Chapter 2\nBeat 2.\n\n## Chapter 3\nBeat 3.\n',
      'stories/01_book/tracking/subplot_threads.md': 'Boiler subplot.',
      'stories/01_book/tracking/interiority/emma.md': 'Emma contradiction engine.',
      [CH1]: chapter({ num: 1, date: '2026-10-01' }),
      [CH2]: `---
chapter: 2
title: "Two"
date: "2026-10-02"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Marta Diaz]
---
It wasn't just a red herring. It was a real clue, she thought.
`,
    };

    withUniverse(files, (root) => {
      const { slices, errors } = pinakes.reviewSlices(root, { story: '01_book', chapter: 2 });
      assert.deepEqual(errors, []);
      assert.equal(slices.length, 6);
      assert.deepEqual(
        slices.map((s) => s.lens),
        ['backward-short', 'backward-mid', 'backward-long', 'forward-short', 'forward-mid', 'forward-long']
      );

      const bMid = slices.find((s) => s.lens === 'backward-mid')!;
      assert.ok(bMid.firstAppearancesBeforeChapter);
      assert.equal(bMid.firstAppearancesBeforeChapter.find((e) => e.id === 'char.marta'), undefined);

      const fMid = slices.find((s) => s.lens === 'forward-mid')!;
      assert.ok(fMid.documents.some((d) => d.label.includes('Interiority Map')));
    });
  });

  test('probabilistic pre-pass escalates mid-confidence flash items to deep scorer and detects craftVocabulary', async () => {
    const cfg = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
probabilistic:
  heldSecrets:
    - id: landlord-secret
      description: "Marta secretly owns the building."
  escalation:
    lowConfidence: 0.35
    highConfidence: 0.65
    leakThreshold: 0.5
    toneCeiling: 7
`;
    const files = {
      'pinakes.yaml': cfg,
      'codex/entities.yaml': GUEST_REGISTRY,
      [CH1]: `---
chapter: 1
title: "One"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
It wasn't a red herring. It was a deliberate trap.
`,
    };

    await new Promise<void>((resolve, reject) => {
      withUniverse(files, (root) => {
        const flashScorer = new pinakes.MockDecisionScorer(
          {
            'secret:landlord-secret': { yes: 0.52, no: 0.48 }, // mid-confidence => escalates to deepScorer
            pov_slip: { yes: 0.05, no: 0.95 },
            'tell:0:negative-parallelism-split:L1': { 'natural-dialogue': 0.2, 'ai-fingerprint': 0.8 },
            'tell:1:craft-vocabulary:L1': { 'natural-dialogue': 0.1, 'ai-fingerprint': 0.9 },
          },
          'mock-flash'
        );
        const deepScorer = new pinakes.MockDecisionScorer(
          {
            'secret:landlord-secret': { yes: 0.82, no: 0.18 }, // confirmed blocker
          },
          'mock-27b'
        );

        pinakes
          .reviewPrepass(root, { story: '01_book', chapter: 1, flashScorer, deepScorer })
          .then(({ result, errors }) => {
            assert.deepEqual(errors, []);
            assert.ok(result);
            assert.ok(result.escalations.some((e) => e.questionId === 'secret:landlord-secret' && e.deepAnswer));
            assert.ok(result.findings.some((f) => f.category === 'firewall' && f.severity === 'blocker'));
            assert.ok(result.findings.some((f) => f.issue.includes('craft-vocabulary')));
            resolve();
          })
          .catch(reject);
      });
    });
  });

  test('mergeReviewFindings highlights multi-lens convergence and sorts by precedence', () => {
    const merged = pinakes.mergeReviewFindings([
      { lens: 'backward-short', severity: 'note', category: 'craft', lineRef: 'L12', issue: 'Awkward seam', fix: 'Smooth' },
      { lens: 'forward-short', severity: 'warn', category: 'arc-fair-play', lineRef: 'L12-L14', issue: 'Early clue drop', fix: 'Hold' },
      { lens: 'backward-long', severity: 'blocker', category: 'firewall', lineRef: 'L40', issue: 'Held secret leaked', fix: 'Cut' },
      { lens: 'backward-mid', severity: 'blocker', category: 'continuity', lineRef: 'L12', issue: 'POV knows name early', fix: 'Use description' },
    ]);

    assert.equal(merged.findings[0].category, 'firewall');
    assert.equal(merged.findings[1].category, 'continuity');
    assert.equal(merged.findings[2].category, 'arc-fair-play');
    assert.equal(merged.findings[3].category, 'craft');
    assert.equal(merged.counts.convergentClusters, 1);
    assert.equal(merged.convergences[0].lenses.length, 3);
  });
});

describe('6. Calibration harness & CLI end-to-end', () => {
  test('runCalibration computes accuracy, Brier score, ECE, and pairwise agreement', async () => {
    const jsonl = [
      JSON.stringify({
        id: 'ex1',
        category: 'character-fit',
        context: 'Emma is cautious.',
        question: { type: 'binary', prompt: 'Is this in-character?', options: ['yes', 'no'] },
        expectedLabel: 'yes',
      }),
      JSON.stringify({
        id: 'ex2',
        category: 'tell-triage',
        context: 'Line: "It was not just coffee."',
        question: { type: 'enum', prompt: 'Classify tell', options: ['natural-dialogue', 'ai-fingerprint'] },
        expectedLabel: 'ai-fingerprint',
      }),
    ].join('\n');

    const { examples, errors } = pinakes.parseCalibrationJsonl(jsonl);
    assert.deepEqual(errors, []);

    const flash = new pinakes.MockDecisionScorer(
      { ex1: { yes: 0.9, no: 0.1 }, ex2: { 'natural-dialogue': 0.2, 'ai-fingerprint': 0.8 } },
      'clef-flash'
    );
    const deep = new pinakes.MockDecisionScorer(
      { ex1: { yes: 0.95, no: 0.05 }, ex2: { 'natural-dialogue': 0.1, 'ai-fingerprint': 0.9 } },
      'clef-27b'
    );

    const report = await pinakes.runCalibration(examples, [flash, deep]);
    assert.equal(report.datasetSize, 2);
    assert.equal(report.scorers[0].accuracy, 1);
    assert.equal(report.pairwiseAgreement[0].agreementRate, 1);
    assert.match(pinakes.renderCalibrationMarkdown(report), /Pinakes Calibration Report/);
  });

  test('CLI commands brief, sample, compose, review, and calibrate exit 0 end-to-end', () => {
    withUniverse({ 'codex/entities.yaml': GUEST_REGISTRY }, (root) => {
      const briefRes = run(root, 'brief', '-s', '01_book', '-c', '1', '--as-of', '2026-10-01', '--characters', 'Emma');
      assert.equal(briefRes.status, 0, briefRes.output);
      assert.match(briefRes.output, /3-Move Character Brief/);

      const briefFile = path.join(root, 'emma_brief.json');
      fs.writeFileSync(
        briefFile,
        JSON.stringify({
          character: 'Emma',
          asOf: '2026-10-01',
          book: 'book1',
          chapter: 1,
          moves: [
            { id: 'A', tactic: 'tA', notice: 'nA', say: 'sA', holdBack: 'hA', physicalTell: 'pA' },
            { id: 'B', tactic: 'tB', notice: 'nB', say: 'sB', holdBack: 'hB', physicalTell: 'pB' },
            { id: 'C', tactic: 'tC', notice: 'nC', say: 'sC', holdBack: 'hC', physicalTell: 'pC' },
          ],
        })
      );
      const logFile = path.join(root, 'emma_roll.json');
      const sampleRes = run(root, 'sample', '-b', briefFile, '--probs', '0.5,0.3,0.2', '--log', logFile);
      assert.equal(sampleRes.status, 0, sampleRes.output);
      assert.ok(fs.existsSync(logFile));

      const composeRes = run(root, 'compose', '--pov', 'Emma', '--moves', logFile, '--setup-text', 'Opening beat.');
      assert.equal(composeRes.status, 0, composeRes.output);
      assert.match(composeRes.output, /Single Narrator Pen Handoff Bundle/);

      const reviewRes = run(root, 'review', '-s', '01_book', '-c', '1', '--lens', 'backward-mid');
      assert.equal(reviewRes.status, 0, reviewRes.output);
      assert.match(reviewRes.output, /First-Appearance Entity Ledger/);

      const prepassRes = run(root, 'review', '-s', '01_book', '-c', '1', '--prepass', '--scorer', 'mock');
      assert.equal(prepassRes.status, 0, prepassRes.output);
      assert.match(prepassRes.output, /Six-Lens Review Board Report/);

      const dsFile = path.join(root, 'cal.jsonl');
      fs.writeFileSync(
        dsFile,
        JSON.stringify({
          id: 'c1',
          category: 'character-fit',
          context: 'ctx',
          question: { type: 'binary', prompt: 'fit?', options: ['yes', 'no'] },
          expectedLabel: 'no',
        }) + '\n'
      );
      const calRes = run(root, 'calibrate', '-d', dsFile, '--scorers', 'mock');
      assert.equal(calRes.status, 0, calRes.output);
      assert.match(calRes.output, /Pinakes Calibration Report/);
    });
  });
});
