#!/usr/bin/env node

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import {
  openUniverse,
  lint,
  compile,
  context,
  proseCheck,
  renderContextMarkdown,
  briefBundles,
  renderCharacterBriefPrompt,
  sampleBrief,
  composeNarrator,
  renderNarratorBundleMarkdown,
  reviewSlices,
  renderReviewSliceMarkdown,
  reviewPrepass,
  renderMergedFindingsMarkdown,
  createDecisionScorer,
  loadCalibrationJsonl,
  runCalibration,
  renderCalibrationMarkdown,
  TEMPORAL_LENSES,
  type Diagnostic,
  type TemporalLens,
  type WinningCharacterMove,
} from './index.js';

/**
 * The version comes from package.json rather than a literal here. A
 * hand-maintained copy drifts: `--version` reported 0.2.0 against a 0.2.1
 * package because a release bumped one and not the other. `../package.json`
 * resolves to cli/package.json from both `dist/cli.js` and `src/cli.ts`.
 */
const { version } = createRequire(import.meta.url)('../package.json');

const program = new Command();

program
  .name('pinakes')
  .description('Fictional continuity linter and AT Protocol record compiler')
  .version(version);

program
  .command('lint')
  .description('Verify story continuity and entity resolution')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action((options) => {
    const root = path.resolve(options.root);
    try {
      const { diagnostics, ok } = lint(root);

      reportDiagnostics(diagnostics);

      if (!ok) {
        console.log(`\nFAIL — pinakes found errors.`);
        process.exit(1);
      } else {
        console.log(`\nOK — all checks passed cleanly.`);
        process.exit(0);
      }
    } catch (e: any) {
      console.error(`Error executing lint: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('compile')
  .description('Compile creative layers into AT Protocol-compliant JSON records')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action((options) => {
    const root = path.resolve(options.root);
    try {
      const universe = openUniverse(root);
      const { config } = universe;
      const { results, lexiconFiles, diagnostics, removed } = compile(universe, { write: true });

      console.log('='.repeat(68));
      console.log('PINAKES COMPILATION — repo -> records');
      console.log('='.repeat(68));
      for (const res of results) {
        console.log(`  ${res.count.toString().padStart(4)} records -> ${res.file}`);
      }
      for (const file of lexiconFiles) {
        console.log(`       lexicon -> ${file}`);
      }
      for (const file of removed ?? []) {
        console.log(`   removed stale -> ${file}`);
      }
      if (removed === null) {
        console.log(
          `\nNote: paths.output (${config.paths.output}) is the project root or contains it, so stale record ` +
            'files were not removed. Point it at a directory of its own, such as `records`.'
        );
      }

      if (diagnostics.length > 0) {
        console.log('');
        reportDiagnostics(diagnostics);
        console.log(`\nFAIL — ${diagnostics.length} problem(s) in the compiled records.`);
        process.exit(1);
      }

      console.log('\nOK — compilation complete, all records match their Lexicons.');
      process.exit(0);
    } catch (e: any) {
      console.error(`Error executing compile: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('prose-check')
  .description('Mechanical prose triage — counts and closers for the AI-tells judgment pass')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-s, --story <name>', 'Limit to one story directory (substring match)')
  .option('--report <name>', 'tells | closers | all', 'all')
  .option('-o, --out <dir>', 'Write markdown files into this directory instead of stdout')
  .action((options) => {
    const root = path.resolve(options.root);
    try {
      const produced = proseCheck(root, { story: options.story, report: options.report });
      if (options.out) {
        const outDir = path.resolve(options.out);
        fs.mkdirSync(outDir, { recursive: true });
        for (const [name, body] of Object.entries(produced)) {
          const file = path.join(outDir, `${name}.md`);
          fs.writeFileSync(file, body + '\n', 'utf-8');
          console.log(`wrote ${file}`);
        }
      } else {
        console.log(Object.values(produced).join('\n\n'));
      }

      // Deliberately no findings-based exit code. These reports are judgment
      // inputs, not pass/fail; `ai_tells.md` is explicit that counts are inputs,
      // not verdicts, and an AI tell is never a blocking finding. Gating CI on
      // this output would contradict the taxonomy that defines it.
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('context')
  .description("Assemble what a character can see as of a story date: long, mid, and short tiers, looking backward only")
  .argument('<character>', 'Character, by registry name or id')
  .requiredOption('--as-of <date>', 'Story date to assemble from, YYYY-MM-DD')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-s, --story <name>', 'Story directory or book key (for book-scoped guest character stubs)')
  .option('--json', 'Emit the bundle as JSON instead of Markdown')
  .option('--full-state', 'Include state-event annotations (authored omnisciently; may exceed what the character knows)')
  .option('-o, --out <file>', 'Write to this file instead of stdout')
  .action((character, options) => {
    const root = path.resolve(options.root);
    try {
      const { bundle, errors } = context(root, character, options.asOf, {
        fullState: Boolean(options.fullState),
        story: options.story,
      });

      if (!bundle) {
        for (const e of errors) console.error(`Error: ${e}`);
        process.exit(1);
      }

      const output = options.json ? JSON.stringify(bundle, null, 2) + '\n' : renderContextMarkdown(bundle);
      if (options.out) {
        fs.writeFileSync(path.resolve(options.out), output, 'utf-8');
        console.error(`Wrote ${options.out}`);
      } else {
        process.stdout.write(output);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('brief')
  .description('Assemble Scene-Mode 3-Move Character Brief prompt bundles (information firewall enforced)')
  .requiredOption('-s, --story <name>', 'Story directory name or book key')
  .requiredOption('-c, --chapter <num>', 'Target chapter number')
  .requiredOption('--as-of <date>', 'Story date, YYYY-MM-DD')
  .requiredOption('--characters <list>', 'Comma-separated list of characters in the scene')
  .option('--setup <file>', 'Markdown/text file describing the immediate scene setup')
  .option('--setup-text <text>', 'Inline scene setup text')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('--json', 'Emit bundles as JSON instead of Markdown')
  .option('-o, --out <dir>', 'Write one file per character into this directory')
  .action((options) => {
    const root = path.resolve(options.root);
    try {
      const sceneSetup = options.setup
        ? fs.readFileSync(path.resolve(options.setup), 'utf-8')
        : (options.setupText ?? '');
      const characters = String(options.characters)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { bundles, errors } = briefBundles(root, {
        story: options.story,
        chapter: isNaN(Number(options.chapter)) ? options.chapter : Number(options.chapter),
        asOf: options.asOf,
        characters,
        sceneSetup,
      });

      if (errors.length > 0) {
        for (const e of errors) console.error(`Error: ${e}`);
        process.exit(1);
      }

      if (options.out) {
        const outDir = path.resolve(options.out);
        fs.mkdirSync(outDir, { recursive: true });
        for (const b of bundles) {
          const slug = b.character.id.split('.', 2)[1] ?? b.character.id;
          const ext = options.json ? 'json' : 'md';
          const content = options.json ? JSON.stringify(b, null, 2) + '\n' : renderCharacterBriefPrompt(b);
          const file = path.join(outDir, `${slug}.${ext}`);
          fs.writeFileSync(file, content, 'utf-8');
          console.error(`Wrote ${file}`);
        }
      } else if (options.json) {
        process.stdout.write(JSON.stringify(bundles, null, 2) + '\n');
      } else {
        process.stdout.write(bundles.map(renderCharacterBriefPrompt).join('\n---\n\n'));
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('Score and deterministically sample a winning move from a 3-Move Character Brief JSON')
  .requiredOption('-b, --brief <file>', 'Path to a 3-Move Character Brief JSON file')
  .option('--probs <pA,pB,pC>', 'Manual raw probabilities for A,B,C (skips scorer call)')
  .option('--scorer <provider>', 'Scorer override: clef | clef-flash | llm | mock')
  .option('--setup <file>', 'Optional scene setup file (passed to scorer)')
  .option('--floor <num>', 'Plausibility floor (default from pinakes.yaml or 0.08)')
  .option('--temp <num>', 'Sampling temperature (default from pinakes.yaml or 0.85)')
  .option('--beat-type <type>', 'Beat type key for per-beat temperature lookup')
  .option('--reroll <token>', 'Optional reroll token appended to the SHA-256 seed')
  .option('--log <file>', 'Write structured SampleRollLog JSON to this file')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    const root = path.resolve(options.root);
    try {
      const brief = JSON.parse(fs.readFileSync(path.resolve(options.brief), 'utf-8'));
      const universe = openUniverse(root);

      let rawProbs: { A: number; B: number; C: number } | undefined;
      if (options.probs) {
        const parts = String(options.probs)
          .split(',')
          .map((s) => Number(s.trim()));
        if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
          throw new Error('--probs must be three comma-separated numbers: pA,pB,pC');
        }
        rawProbs = { A: parts[0], B: parts[1], C: parts[2] };
      }

      const scorer = options.scorer
        ? createDecisionScorer(universe.config, { provider: options.scorer })
        : undefined;
      const sceneSetup = options.setup ? fs.readFileSync(path.resolve(options.setup), 'utf-8') : '';

      const outcome = await sampleBrief(universe, brief, {
        rawProbs,
        scorer,
        sceneSetup,
        floor: options.floor !== undefined ? Number(options.floor) : undefined,
        temperature: options.temp !== undefined ? Number(options.temp) : undefined,
        beatType: options.beatType,
        reroll: options.reroll,
      });

      if (!outcome.ok || !outcome.log) {
        console.error(`Error: ${outcome.error ?? 'Sampling failed.'}`);
        process.exit(1);
      }

      const json = JSON.stringify(outcome.log, null, 2) + '\n';
      if (options.log) {
        fs.writeFileSync(path.resolve(options.log), json, 'utf-8');
        console.error(`Wrote roll log to ${options.log}`);
      }
      process.stdout.write(json);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('compose')
  .description('Assemble a POV-locked Single Narrator Pen Handoff bundle from winning moves')
  .requiredOption('--pov <character>', 'POV character (receives full interiority; all others stripped to observable surface)')
  .requiredOption('--moves <files...>', 'One or more SampleRollLog or WinningCharacterMove JSON files')
  .option('--setup <file>', 'Scene setup file')
  .option('--setup-text <text>', 'Inline scene setup text')
  .option('--writing-guide <file>', 'Path to writing guide (overrides pinakes.yaml)')
  .option('--book <key>', 'Book key metadata')
  .option('--chapter <num>', 'Chapter number metadata')
  .option('--as-of <date>', 'Story date metadata')
  .option('--json', 'Emit bundle as JSON instead of Markdown')
  .option('-o, --out <file>', 'Write output to this file instead of stdout')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action((options) => {
    const root = path.resolve(options.root);
    try {
      const winningMoves: WinningCharacterMove[] = [];
      for (const f of options.moves as string[]) {
        const parsed = JSON.parse(fs.readFileSync(path.resolve(f), 'utf-8'));
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item.chosenMove && item.seedInput) {
            // SampleRollLog shape: `<book>:<chapter>:<date>:<character>[:reroll]`
            const parts = String(item.seedInput).split(':');
            const character = item.character ?? parts[3] ?? 'Unknown';
            winningMoves.push({ character, move: item.chosenMove });
          } else if (item.character && item.move) {
            winningMoves.push({ character: item.character, characterId: item.characterId, move: item.move });
          } else {
            throw new Error(`Unrecognized move JSON shape in ${f}. Expected SampleRollLog or { character, move }.`);
          }
        }
      }

      const sceneSetup = options.setup
        ? fs.readFileSync(path.resolve(options.setup), 'utf-8')
        : (options.setupText ?? '');

      const { bundle, errors } = composeNarrator(root, {
        book: options.book,
        chapter: options.chapter,
        asOf: options.asOf,
        povCharacter: options.pov,
        sceneSetup,
        winningMoves,
        writingGuidePath: options.writingGuide,
      });

      if (!bundle || errors.length > 0) {
        for (const e of errors) console.error(`Error: ${e}`);
        process.exit(1);
      }

      const output = options.json ? JSON.stringify(bundle, null, 2) + '\n' : renderNarratorBundleMarkdown(bundle);
      if (options.out) {
        fs.writeFileSync(path.resolve(options.out), output, 'utf-8');
        console.error(`Wrote ${options.out}`);
      } else {
        process.stdout.write(output);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('review')
  .description('Six-Lens Temporal Review Board — assemble temporal slices and/or run probabilistic lint pre-pass')
  .requiredOption('-s, --story <name>', 'Story directory name or book key')
  .requiredOption('-c, --chapter <num>', 'Target chapter number')
  .option('--lens <name>', `Lens to assemble: ${TEMPORAL_LENSES.join(' | ')} | all`, 'all')
  .option('--prepass', 'Run the Clef-flash -> Clef 27B probabilistic lint pre-pass')
  .option('--scorer <provider>', 'Scorer override for pre-pass: clef | clef-flash | llm | mock')
  .option('--json', 'Emit JSON instead of Markdown')
  .option('-o, --out <dir>', 'Write slice/report files into this directory')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    const root = path.resolve(options.root);
    try {
      const universe = openUniverse(root);
      const chapter = isNaN(Number(options.chapter)) ? options.chapter : Number(options.chapter);

      if (options.prepass) {
        const flashScorer = options.scorer
          ? createDecisionScorer(universe.config, { provider: options.scorer })
          : undefined;
        const { result, errors } = await reviewPrepass(universe, {
          story: options.story,
          chapter,
          flashScorer,
        });
        if (!result || errors.length > 0) {
          for (const e of errors) console.error(`Error: ${e}`);
          process.exit(1);
        }
        const out = options.json
          ? JSON.stringify(result, null, 2) + '\n'
          : renderMergedFindingsMarkdown(result.merged);
        if (options.out) {
          const outDir = path.resolve(options.out);
          fs.mkdirSync(outDir, { recursive: true });
          const file = path.join(outDir, `prepass.${options.json ? 'json' : 'md'}`);
          fs.writeFileSync(file, out, 'utf-8');
          console.error(`Wrote ${file}`);
        } else {
          process.stdout.write(out);
        }
        return;
      }

      const lenses: TemporalLens[] =
        options.lens === 'all' ? [...TEMPORAL_LENSES] : [options.lens as TemporalLens];
      for (const l of lenses) {
        if (!TEMPORAL_LENSES.includes(l)) {
          throw new Error(`Unknown lens '${l}'. Expected one of: ${TEMPORAL_LENSES.join(', ')}, all`);
        }
      }

      const { slices, errors } = reviewSlices(universe, { story: options.story, chapter, lenses });
      if (errors.length > 0) {
        for (const e of errors) console.error(`Error: ${e}`);
        process.exit(1);
      }

      if (options.out) {
        const outDir = path.resolve(options.out);
        fs.mkdirSync(outDir, { recursive: true });
        for (const sl of slices) {
          const ext = options.json ? 'json' : 'md';
          const content = options.json ? JSON.stringify(sl, null, 2) + '\n' : renderReviewSliceMarkdown(sl);
          const file = path.join(outDir, `${sl.lens}.${ext}`);
          fs.writeFileSync(file, content, 'utf-8');
          console.error(`Wrote ${file}`);
        }
      } else if (options.json) {
        process.stdout.write(JSON.stringify(slices, null, 2) + '\n');
      } else {
        process.stdout.write(slices.map(renderReviewSliceMarkdown).join('\n---\n\n'));
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('calibrate')
  .description('Evaluate DecisionScorers (e.g. clef-flash vs clef) against a JSONL dataset of labeled beats')
  .requiredOption('-d, --dataset <file>', 'Path to JSONL calibration dataset')
  .option('--scorers <list>', 'Comma-separated scorers: clef-flash,clef,mock,llm', 'clef-flash,clef')
  .option('--json', 'Emit JSON report instead of Markdown')
  .option('-o, --out <file>', 'Write report to this file instead of stdout')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    const root = path.resolve(options.root);
    try {
      const { examples, errors } = loadCalibrationJsonl(path.resolve(options.dataset));
      if (errors.length > 0) {
        for (const e of errors) console.error(`Error: ${e}`);
        process.exit(1);
      }
      if (examples.length === 0) {
        throw new Error('Calibration dataset is empty.');
      }

      const universe = openUniverse(root);
      const scorerNames = String(options.scorers)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as ('clef' | 'clef-flash' | 'llm' | 'mock')[];

      const scorers = scorerNames.map((provider) => createDecisionScorer(universe.config, { provider }));
      const report = await runCalibration(examples, scorers);
      const out = options.json ? JSON.stringify(report, null, 2) + '\n' : renderCalibrationMarkdown(report);
      if (options.out) {
        fs.writeFileSync(path.resolve(options.out), out, 'utf-8');
        console.error(`Wrote ${options.out}`);
      } else {
        process.stdout.write(out);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new universe directory from the Pinakes template')
  .argument('[directory]', 'Directory to initialize (defaults to current directory)', '.')
  .action((directory) => {
    const dest = path.resolve(directory);
    try {
      const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'template');
      
      if (!fs.existsSync(src)) {
        // Fallback for development if executed directly from src/ (not dist/)
        const devSrc = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../template'));
        if (fs.existsSync(devSrc)) {
          fs.cpSync(devSrc, dest, { recursive: true });
        } else {
          throw new Error('Template folder not found.');
        }
      } else {
        fs.cpSync(src, dest, { recursive: true });
      }

      console.log(`\n🎉 Successfully initialized Pinakes universe at: ${dest}`);
      console.log('You can now run:');
      console.log('  pinakes lint');
      console.log('  pinakes compile\n');
    } catch (e: any) {
      console.error(`Error initializing project: ${e.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

function reportDiagnostics(diagnostics: Diagnostic[]) {
  console.log('='.repeat(70));
  console.log('PINAKES CONTINUITY CHECK');
  console.log('='.repeat(70));

  if (diagnostics.length === 0) {
    console.log('  No issues found.');
    return;
  }

  // Group by file
  const grouped = diagnostics.reduce((acc, d) => {
    if (!acc[d.file]) acc[d.file] = [];
    acc[d.file].push(d);
    return acc;
  }, {} as Record<string, Diagnostic[]>);

  for (const [file, items] of Object.entries(grouped)) {
    console.log(`\n📁 ${file}:`);
    for (const d of items) {
      const lineStr = d.line ? `:${d.line}` : '';
      const prefix = d.severity === 'error' ? '🔴 ERROR' : '🟡 WARNING';
      console.log(`  ${lineStr.padEnd(5)} [${d.rule}] ${prefix}: ${d.message}`);
    }
  }
}
