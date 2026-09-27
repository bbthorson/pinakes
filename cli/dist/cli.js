#!/usr/bin/env node
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { openUniverse, lint, compile, context, proseCheck, renderContextMarkdown } from './index.js';
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
        }
        else {
            console.log(`\nOK — all checks passed cleanly.`);
            process.exit(0);
        }
    }
    catch (e) {
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
            console.log(`\nNote: paths.output (${config.paths.output}) is the project root or contains it, so stale record ` +
                'files were not removed. Point it at a directory of its own, such as `records`.');
        }
        if (diagnostics.length > 0) {
            console.log('');
            reportDiagnostics(diagnostics);
            console.log(`\nFAIL — ${diagnostics.length} problem(s) in the compiled records.`);
            process.exit(1);
        }
        console.log('\nOK — compilation complete, all records match their Lexicons.');
        process.exit(0);
    }
    catch (e) {
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
        }
        else {
            console.log(Object.values(produced).join('\n\n'));
        }
        // Deliberately no findings-based exit code. These reports are judgment
        // inputs, not pass/fail; `ai_tells.md` is explicit that counts are inputs,
        // not verdicts, and an AI tell is never a blocking finding. Gating CI on
        // this output would contradict the taxonomy that defines it.
    }
    catch (e) {
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
    .option('--json', 'Emit the bundle as JSON instead of Markdown')
    .option('--full-state', 'Include state-event annotations (authored omnisciently; may exceed what the character knows)')
    .option('-o, --out <file>', 'Write to this file instead of stdout')
    .action((character, options) => {
    const root = path.resolve(options.root);
    try {
        const { bundle, errors } = context(root, character, options.asOf, { fullState: Boolean(options.fullState) });
        if (!bundle) {
            for (const e of errors)
                console.error(`Error: ${e}`);
            process.exit(1);
        }
        const output = options.json ? JSON.stringify(bundle, null, 2) + '\n' : renderContextMarkdown(bundle);
        if (options.out) {
            fs.writeFileSync(path.resolve(options.out), output, 'utf-8');
            console.error(`Wrote ${options.out}`);
        }
        else {
            process.stdout.write(output);
        }
    }
    catch (e) {
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
            }
            else {
                throw new Error('Template folder not found.');
            }
        }
        else {
            fs.cpSync(src, dest, { recursive: true });
        }
        console.log(`\n🎉 Successfully initialized Pinakes universe at: ${dest}`);
        console.log('You can now run:');
        console.log('  pinakes lint');
        console.log('  pinakes compile\n');
    }
    catch (e) {
        console.error(`Error initializing project: ${e.message}`);
        process.exit(1);
    }
});
program.parse(process.argv);
function reportDiagnostics(diagnostics) {
    console.log('='.repeat(70));
    console.log('PINAKES CONTINUITY CHECK');
    console.log('='.repeat(70));
    if (diagnostics.length === 0) {
        console.log('  No issues found.');
        return;
    }
    // Group by file
    const grouped = diagnostics.reduce((acc, d) => {
        if (!acc[d.file])
            acc[d.file] = [];
        acc[d.file].push(d);
        return acc;
    }, {});
    for (const [file, items] of Object.entries(grouped)) {
        console.log(`\n📁 ${file}:`);
        for (const d of items) {
            const lineStr = d.line ? `:${d.line}` : '';
            const prefix = d.severity === 'error' ? '🔴 ERROR' : '🟡 WARNING';
            console.log(`  ${lineStr.padEnd(5)} [${d.rule}] ${prefix}: ${d.message}`);
        }
    }
}
