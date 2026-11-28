/**
 * Tests for Pinakes 1.2.0 improvements:
 * 1. Witness / off-page knowledge check in `pinakes review --prepass`
 * 2. Calendar & day-of-week lint checks in `pinakes lint`
 * 3. Chapter split / renumber helper (`pinakes renumber`)
 * 4. Affect engine refinements (`focused`, `proud`, `guilty`, `stricken` + crisis/shock tolerance)
 * 5. Scene-Mode ensemble ergonomics (`sample` dir/array, `scene-run`, `brief` registry fallback)
 * 6. Culinary/botanical `seed` craft-vocabulary guard & `EPIPE` clean exit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as pinakes from '@bbthorson/pinakes';
import { chapter, cleanup, makeUniverse, run, withUniverse, type Files } from './helpers.ts';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

const REGISTRY = `characters:
  - id: char.emma
    type: character
    displayName: Emma
    sourceFile: codex/characters/emma.md
  - id: char.leo
    type: character
    displayName: Leo
    aliases: [L.]
  - id: char.marco
    type: character
    displayName: Marco
    description: "Neighborhood espresso barista who remembers everyone's regular order."
places:
  - id: place.bar
    type: place
    displayName: The Bar
`;

function makeBrief(character: string, book = 'book1', chapterNum = 1, asOf = '2026-10-01'): pinakes.CharacterBrief {
  return {
    character,
    asOf,
    book,
    chapter: chapterNum,
    moves: [
      { id: 'A', tactic: `${character} tactic A`, notice: `${character} notice A`, say: `${character} says A`, holdBack: `${character} SECRET A`, physicalTell: `${character} tell A` },
      { id: 'B', tactic: `${character} tactic B`, notice: `${character} notice B`, say: `${character} says B`, holdBack: `${character} SECRET B`, physicalTell: `${character} tell B` },
      { id: 'C', tactic: `${character} tactic C`, notice: `${character} notice C`, say: `${character} says C`, holdBack: `${character} SECRET C`, physicalTell: `${character} tell C` },
    ],
  };
}

describe('1. Witness / off-page knowledge check in review --prepass', () => {
  test('flags character quoting or recounting a prior chapter beat when absent and unbridged', async () => {
    const files: Files = {
      'codex/entities.yaml': REGISTRY,
      'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "The Pantry"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
beat_purpose: "Emma discovers the cracked porcelain teacup behind the flour tins."
---
Emma lifted the cracked porcelain teacup behind the flour tins.
"Never trust a locked pantry after midnight," Emma whispered.
`,
      'stories/01_book/chapters/02_two.md': `---
chapter: 2
title: "Next Morning"
date: "2026-10-02"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Leo]
---
Leo leaned on the counter and smirked.
"Never trust a locked pantry after midnight," Leo said.
`,
    };

    await new Promise<void>((resolve, reject) => {
      withUniverse(files, (root) => {
        const flash = new pinakes.MockDecisionScorer({}, 'mock-flash');
        pinakes
          .reviewPrepass(root, { story: '01_book', chapter: 2, flashScorer: flash })
          .then(({ result, errors }) => {
            assert.deepEqual(errors, []);
            assert.ok(result);
            const witness = result.findings.find(
              (f) => f.lens === 'backward-short' && f.severity === 'warn' && f.issue.includes('Off-page knowledge check')
            );
            assert.ok(witness, `Expected backward-short witness warning; got: ${JSON.stringify(result.findings)}`);
            assert.match(witness.issue, /Leo/);
            assert.match(witness.issue, /Ch 1/);
            assert.equal(witness.category, 'continuity');
            resolve();
          })
          .catch(reject);
      });
    });
  });

  test('does not flag when a message/handoff cue or intervening shared chapter bridges them', async () => {
    const files: Files = {
      'codex/entities.yaml': REGISTRY,
      'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "The Pantry"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
"Never trust a locked pantry after midnight," Emma whispered.
`,
      'stories/01_book/chapters/02_two.md': `---
chapter: 2
title: "Group Chat"
date: "2026-10-02"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Leo]
---
Emma had texted Leo the whole story before sunrise.
"Never trust a locked pantry after midnight," Leo said with a grin.
`,
    };

    await new Promise<void>((resolve, reject) => {
      withUniverse(files, (root) => {
        const flash = new pinakes.MockDecisionScorer({}, 'mock-flash');
        pinakes
          .reviewPrepass(root, { story: '01_book', chapter: 2, flashScorer: flash })
          .then(({ result, errors }) => {
            assert.deepEqual(errors, []);
            assert.ok(result);
            const witness = result.findings.find((f) => f.issue.includes('Off-page knowledge check'));
            assert.equal(witness, undefined);
            resolve();
          })
          .catch(reject);
      });
    });
  });

  test('does not flag when the character was present in the prior chapter', async () => {
    const files: Files = {
      'codex/entities.yaml': REGISTRY,
      'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "The Pantry"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Leo]
---
"Never trust a locked pantry after midnight," Emma whispered.
`,
      'stories/01_book/chapters/02_two.md': `---
chapter: 2
title: "Next Morning"
date: "2026-10-02"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Leo]
---
"Never trust a locked pantry after midnight," Leo said.
`,
    };

    await new Promise<void>((resolve, reject) => {
      withUniverse(files, (root) => {
        const flash = new pinakes.MockDecisionScorer({}, 'mock-flash');
        pinakes
          .reviewPrepass(root, { story: '01_book', chapter: 2, flashScorer: flash })
          .then(({ result, errors }) => {
            assert.deepEqual(errors, []);
            assert.ok(result);
            const witness = result.findings.find((f) => f.issue.includes('Off-page knowledge check'));
            assert.equal(witness, undefined);
            resolve();
          })
          .catch(reject);
      });
    });
  });
});

describe('2. Calendar & day-of-week lint checks', () => {
  test('day-of-week-mismatch fails lint when day: disagrees with ISO date: and passes when matching', () => {
    // 2026-10-03 is a Saturday
    withUniverse(
      {
        'stories/01_book/chapters/01_one.md': chapter({
          num: 1,
          date: '2026-10-03',
          extra: 'day: "Tuesday"\n',
        }),
      },
      (root) => {
        const res = run(root, 'lint');
        assert.equal(res.status, 1, res.output);
        assert.match(res.output, /\[day-of-week-mismatch\]/);
        assert.match(res.output, /Tuesday.*2026-10-03.*Saturday/);
      }
    );

    withUniverse(
      {
        'stories/01_book/chapters/01_one.md': chapter({
          num: 1,
          date: '2026-10-03',
          extra: 'day: "Saturday evening"\n',
        }),
      },
      (root) => {
        const res = run(root, 'lint');
        assert.equal(res.status, 0, res.output);
        assert.doesNotMatch(res.output, /day-of-week-mismatch/);
      }
    );
  });

  test('day-of-week-mismatch checks both ends of a date range', () => {
    // 2026-10-05 is Monday, 2026-10-07 is Wednesday
    withUniverse(
      {
        'stories/01_book/chapters/01_one.md': chapter({
          num: 1,
          date: '2026-10-05 → 2026-10-07',
          extra: 'day: "Monday → Thursday"\n',
        }),
      },
      (root) => {
        const res = run(root, 'lint');
        assert.equal(res.status, 1, res.output);
        assert.match(res.output, /\[day-of-week-mismatch\]/);
        assert.match(res.output, /Thursday.*2026-10-07.*Wednesday/);
      }
    );
  });

  test('weekend-weekday-phrase warns on Saturday/Sunday prose unless inside dialogue referencing another day', () => {
    // 2026-10-03 is Saturday
    withUniverse(
      {
        'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "Saturday"
date: "2026-10-03"
day: "Saturday"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
The morning commute clogged the avenue outside the window.
"We should beat the Monday rush hour next week," Emma said.
"I hate school pickup," Leo muttered.
`,
      },
      (root) => {
        const { diagnostics, ok } = pinakes.lint(root);
        assert.equal(ok, true); // warning only
        const hits = diagnostics.filter((d) => d.rule === 'weekend-weekday-phrase');
        assert.equal(hits.length, 2, `Expected 2 warnings (morning commute, school pickup), got: ${JSON.stringify(hits)}`);
        assert.ok(hits.some((h) => h.message.includes('morning commute')));
        assert.ok(hits.some((h) => h.message.includes('school pickup')));
        assert.ok(!hits.some((h) => h.message.includes('rush hour')));
      }
    );
  });
});

describe('3. Chapter split / renumber helper (pinakes renumber)', () => {
  test('shifts filenames, frontmatter chapter numbers, and Chapter <Word> headings, and reports stale Ch N refs', () => {
    const files: Files = {
      'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "One"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
# Chapter One

Opening beat.
`,
      'stories/01_book/chapters/02_two.md': `---
chapter: 2
title: "Two"
date: "2026-10-02"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
# Chapter Two: The Door

### Chapter Two

Body two.
`,
      'stories/01_book/chapters/03.md': `---
chapter: 3
title: "Three"
date: "2026-10-03"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
# Chapter Three

Body three.
`,
      'stories/01_book/00_story_outline.md': '## Ch 1\nIntro\n## Ch 2\nMid\n## Ch3\nEnd\n',
      'stories/01_book/audit_notes.md': 'Check continuity between Ch 1 and Ch 2.\n',
      'stories/01_book/tracking/subplots.md': 'Payoff lands in Chapter 3.\n',
    };

    withUniverse(files, (root) => {
      const res = run(root, 'renumber', '-s', 'book1', '--from', '2', '--delta', '+1');
      assert.equal(res.status, 0, res.output);

      // Chapter 1 untouched; 2 -> 3, 3 -> 4
      assert.ok(fs.existsSync(path.join(root, 'stories/01_book/chapters/01_one.md')));
      assert.ok(!fs.existsSync(path.join(root, 'stories/01_book/chapters/02_two.md')));
      assert.ok(fs.existsSync(path.join(root, 'stories/01_book/chapters/03_two.md')));
      assert.ok(fs.existsSync(path.join(root, 'stories/01_book/chapters/04.md')));

      const ch3Text = fs.readFileSync(path.join(root, 'stories/01_book/chapters/03_two.md'), 'utf-8');
      assert.match(ch3Text, /^chapter: 3$/m);
      assert.match(ch3Text, /^# Chapter Three: The Door$/m);
      assert.match(ch3Text, /^### Chapter Three$/m);

      const ch4Text = fs.readFileSync(path.join(root, 'stories/01_book/chapters/04.md'), 'utf-8');
      assert.match(ch4Text, /^chapter: 4$/m);
      assert.match(ch4Text, /^# Chapter Four$/m);

      // Reports stale references in outline, audit_notes, tracking
      assert.match(res.output, /00_story_outline\.md/);
      assert.match(res.output, /audit_notes\.md/);
      assert.match(res.output, /tracking\/subplots\.md/);
      assert.match(res.output, /Ch 2 -> Ch 3/);
      assert.match(res.output, /Ch3 -> Ch 4/);

      // Shift back down with `--delta -1` (tests negative delta CLI parsing!)
      const back = run(root, 'renumber', '-s', 'book1', '--from', '3', '--delta', '-1');
      assert.equal(back.status, 0, back.output);
      assert.ok(fs.existsSync(path.join(root, 'stories/01_book/chapters/02_two.md')));
      assert.ok(fs.existsSync(path.join(root, 'stories/01_book/chapters/03.md')));
    });
  });

  test('fails closed if shifting down would collide with an existing unshifted chapter', () => {
    const files: Files = {
      'stories/01_book/chapters/01_one.md': chapter({ num: 1, date: '2026-10-01' }),
      'stories/01_book/chapters/02_two.md': chapter({ num: 2, date: '2026-10-02' }),
    };

    withUniverse(files, (root) => {
      const res = run(root, 'renumber', '-s', 'book1', '--from', '2', '--delta', '-1');
      assert.equal(res.status, 1, res.output);
      assert.match(res.output, /already exists/);
      // Original files must remain untouched
      assert.ok(fs.existsSync(path.join(root, 'stories/01_book/chapters/02_two.md')));
    });
  });
});

describe('4. Affect engine refinements', () => {
  test('focused, proud, guilty, and stricken are built-in core affect labels', () => {
    for (const label of ['focused', 'proud', 'guilty', 'stricken']) {
      assert.ok(label in pinakes.CORE_AFFECT_LABELS, `Missing core label: ${label}`);
    }

    const files: Files = {
      'stories/01_book/chapters/01_one.md': chapter({
        num: 1,
        date: '2026-10-01',
        extra: 'registers:\n  Emma: private\n  Leo: private\naffect:\n  Emma: "focused → proud"\n  Leo: "guilty → stricken"\n',
      }),
    };

    withUniverse(files, (root) => {
      const { diagnostics, ok } = pinakes.lint(root);
      assert.equal(ok, true, JSON.stringify(diagnostics));
      assert.equal(
        diagnostics.filter((d) => d.rule === 'affect-label-unresolved').length,
        0,
        JSON.stringify(diagnostics)
      );
    });
  });

  test('affect_shock: true and crisis beats tolerate sudden affect-discontinuity jumps', () => {
    const baseConfig = `spec: 0.1
project:
  name: Test Universe
  nsid: test.universe
paths:
  registry: codex/entities.yaml
  stories: stories
  output: records
affect:
  dynamics:
    halfLifeDays: 4
    discontinuity: 70
`;
    const stretch = `---
character: Emma
asOf: "2026-10-02"
since: "2026-09-01"
register: private
status: approved
sources:
  - scene.book1.ch1
affect: warm
---
Feeling warm and settled.
`;
    const makeFiles = (ch2Extra: string): Files => ({
      'pinakes.yaml': baseConfig,
      'codex/entities.yaml': REGISTRY,
      'codex/characters/emma.md': '---\naffectBaseline: warm\n---\n# Emma\n',
      'stories/01_book/chapters/01_one.md': chapter({ num: 1, date: '2026-10-01', extra: 'registers:\n  Emma: private\n' }),
      'stories/01_book/stretches/emma/2026-10-02.md': stretch,
      'stories/01_book/chapters/02_two.md': chapter({
        num: 2,
        date: '2026-10-03',
        extra: `registers:\n  Emma: private\naffect:\n  Emma: "alarmed → stricken"\n${ch2Extra}`,
      }),
    });

    // Without shock flag or crisis beat: warm (60,10,30) -> alarmed (-60,70,-30), distance ~147 > 70 -> warns
    withUniverse(makeFiles(''), (root) => {
      const { diagnostics } = pinakes.lint(root);
      assert.ok(diagnostics.some((d) => d.rule === 'affect-discontinuity'));
    });

    // With `affect_shock: true`: exempts the chapter from discontinuity warning
    withUniverse(makeFiles('affect_shock: true\n'), (root) => {
      const { diagnostics } = pinakes.lint(root);
      assert.equal(diagnostics.filter((d) => d.rule === 'affect-discontinuity').length, 0);
    });

    // With crisis beat `All Is Lost` (widens threshold 2x: 70 -> 140) and `guilty` (-60,20,-50) vs warm (60,10,30) dist=145 -> wait, test curious (40,30,20) vs alarmed (-60,70,-30) dist=119 <= 140
    const crisisStretch = stretch.replace('affect: warm', 'affect: curious');
    const crisisFiles: Files = {
      ...makeFiles('beat: "Act II — Bad Guys Close In"\n'),
      'codex/characters/emma.md': '---\naffectBaseline: curious\n---\n# Emma\n',
      'stories/01_book/stretches/emma/2026-10-02.md': crisisStretch,
    };
    withUniverse(crisisFiles, (root) => {
      const { diagnostics } = pinakes.lint(root);
      assert.equal(diagnostics.filter((d) => d.rule === 'affect-discontinuity').length, 0);
    });
  });
});

describe('5. Scene-Mode ensemble ergonomics (sample dir/array, scene-run, brief registry fallback)', () => {
  test('pinakes sample accepts a directory or multi-character JSON array and writes one roll log per character', () => {
    withUniverse({ 'codex/entities.yaml': REGISTRY }, (root) => {
      const briefsDir = path.join(root, 'briefs');
      fs.mkdirSync(briefsDir, { recursive: true });
      fs.writeFileSync(path.join(briefsDir, 'emma.json'), JSON.stringify(makeBrief('Emma')));
      fs.writeFileSync(path.join(briefsDir, 'leo.json'), JSON.stringify(makeBrief('Leo')));

      const logsDir = path.join(root, 'logs_from_dir');
      const dirRes = run(root, 'sample', '-b', briefsDir, '--probs', '0.5,0.3,0.2', '--log', logsDir);
      assert.equal(dirRes.status, 0, dirRes.output);
      assert.ok(fs.existsSync(path.join(logsDir, 'emma_roll.json')));
      assert.ok(fs.existsSync(path.join(logsDir, 'leo_roll.json')));

      // Single multi-character JSON array
      const arrayFile = path.join(root, 'ensemble.json');
      fs.writeFileSync(arrayFile, JSON.stringify([makeBrief('Emma'), makeBrief('Leo')]));
      const logsArrDir = path.join(root, 'logs_from_array');
      const arrRes = run(root, 'sample', '-b', arrayFile, '--probs', '0.5,0.3,0.2', '--log', logsArrDir);
      assert.equal(arrRes.status, 0, arrRes.output);
      assert.ok(fs.existsSync(path.join(logsArrDir, 'emma_roll.json')));
      assert.ok(fs.existsSync(path.join(logsArrDir, 'leo_roll.json')));
    });
  });

  test('pinakes scene-run chains sample -> compose and enforces POV lock', () => {
    withUniverse({ 'codex/entities.yaml': REGISTRY }, (root) => {
      const arrayFile = path.join(root, 'ensemble.json');
      fs.writeFileSync(arrayFile, JSON.stringify([makeBrief('Emma'), makeBrief('Leo')]));
      const logDir = path.join(root, 'scene_logs');

      const res = run(
        root,
        'scene-run',
        '-b',
        arrayFile,
        '--pov',
        'Emma',
        '--probs',
        '0.5,0.3,0.2',
        '--setup-text',
        'Morning at the bar.',
        '--log-dir',
        logDir
      );
      assert.equal(res.status, 0, res.output);
      assert.match(res.output, /Single Narrator Pen Handoff Bundle/);
      assert.match(res.output, /Emma SECRET/);
      assert.doesNotMatch(res.output, /Leo SECRET/);
      assert.ok(fs.existsSync(path.join(logDir, 'emma_roll.json')));
      assert.ok(fs.existsSync(path.join(logDir, 'leo_roll.json')));
    });
  });

  test('pinakes brief gracefully falls back to entities.yaml description + prior stateEvents/affectEvents when codex file is absent', () => {
    const files: Files = {
      'codex/entities.yaml': REGISTRY,
      'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "Chapter 1"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma, Marco]
registers:
  Marco: "public (OMNISCIENT SECRET NOTE)"
affect:
  Marco: "warm → focused"
---
Body of chapter 1.
`,
    };

    withUniverse(files, (root) => {
      const { bundles, errors } = pinakes.briefBundles(root, {
        story: '01_book',
        chapter: 2,
        asOf: '2026-10-02',
        characters: ['Marco'],
        sceneSetup: 'Emma orders an espresso from Marco.',
      });
      assert.deepEqual(errors, []);
      assert.equal(bundles.length, 1);
      const marco = bundles[0];
      assert.equal(marco.context.long.sourceScope, 'registry');
      assert.match(marco.contextMarkdown, /Neighborhood espresso barista/);
      assert.match(marco.contextMarkdown, /Prior State Events/);
      assert.match(marco.contextMarkdown, /stateEvent\.marco\.book1\.ch1/);
      assert.match(marco.contextMarkdown, /Prior Affect Events/);
      assert.match(marco.contextMarkdown, /affect\.event\.marco\.book1\.ch1/);
      // Scene-Mode firewall still holds: omniscient register annotation must NOT leak
      assert.doesNotMatch(marco.contextMarkdown, /OMNISCIENT SECRET NOTE/);
    });
  });
});

describe('6. Craft-vocabulary seed guard & CLI EPIPE handling', () => {
  test('seed craft-vocabulary regex ignores culinary/botanical compounds while flagging narrative craft usage', () => {
    const body = [
      'Emma set out poppy-seed rolls, sesame seed buns, caraway seeds, mustard seed, sunflower seeds, and pumpkin-seed brittle.',
      'She tried to seed the conversation with a hint, just like she had seeded the rumor last week.',
    ].join('\n');

    withUniverse({}, (root) => {
      const u = pinakes.openUniverse(root);
      const hits = pinakes.collectAmbiguousTellHits(body, u.config);
      const craftHits = hits.filter((h) => h.label === 'craft-vocabulary');
      assert.equal(craftHits.length, 2, `Expected exactly 2 narrative seed hits, got: ${JSON.stringify(craftHits)}`);
      assert.ok(craftHits.every((h) => h.lineNum === 2));
    });
  });

  test('piping CLI output into a closed stdout pipe exits cleanly (code 0) without unhandled EPIPE', async () => {
    const files: Files = {
      'codex/entities.yaml': REGISTRY,
      'stories/01_book/chapters/01_one.md': `---
chapter: 1
title: "One"
date: "2026-10-01"
location: ["The Bar"]
pov: Emma
characters_present: [Emma]
---
${'A long chapter line to ensure stdout writes multiple chunks.\n'.repeat(2000)}`,
    };

    const root = makeUniverse(files);
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'review', '-s', '01_book', '-c', '1', '--json', '--root', root], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr.on('data', (chunk) => {
          stderr += String(chunk);
        });
        child.stdout.once('data', () => {
          child.stdout.destroy();
        });
        child.on('close', (code) => {
          try {
            assert.equal(code, 0, `Expected clean exit 0 on EPIPE, got ${code}; stderr: ${stderr}`);
            assert.doesNotMatch(stderr, /EPIPE|Unhandled/i);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        child.on('error', reject);
      });
    } finally {
      cleanup(root);
    }
  });
});
