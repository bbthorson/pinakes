#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { loadConfig } from './config.js';
import { Registry } from './registry/entities.js';
import { LinterEngine, Diagnostic } from './linter/engine.js';
import { YamlRulesLoader } from './linter/yaml-loader.js';
import { compileProject } from './compiler/atproto.js';

const program = new Command();

program
  .name('pinakes')
  .description('Fictional continuity linter and AT Protocol record compiler')
  .version('0.2.0');

program
  .command('lint')
  .description('Verify story continuity and entity resolution')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action((options) => {
    const root = path.resolve(options.root);
    try {
      const { config } = loadConfig(root);
      const registry = new Registry(root, config.paths.registry, config.paths.nonEntities);
      const engine = new LinterEngine(root, config, registry);

      // Run built-in linting
      const diagnostics = engine.lint();

      // Run custom rules if path is defined
      if (config.paths.rules) {
        const customRulesLoader = new YamlRulesLoader(root, config.paths.rules);
        const stories = engine.getStories();
        for (const storyDir of stories) {
          const chapters = engine.loadChapters(storyDir);
          const customDiagnostics = customRulesLoader.runCustomRules(chapters);
          diagnostics.push(...customDiagnostics);
        }
      }

      reportDiagnostics(diagnostics);

      const hasErrors = diagnostics.some((d) => d.severity === 'error');
      if (hasErrors) {
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
      const { config } = loadConfig(root);
      const registry = new Registry(root, config.paths.registry, config.paths.nonEntities);
      const engine = new LinterEngine(root, config, registry);

      const { results, lexiconFiles, diagnostics } = compileProject(root, config, registry, engine);

      console.log('='.repeat(68));
      console.log('PINAKES COMPILATION — repo -> records');
      console.log('='.repeat(68));
      for (const res of results) {
        console.log(`  ${res.count.toString().padStart(4)} records -> ${res.file}`);
      }
      for (const file of lexiconFiles) {
        console.log(`       lexicon -> ${file}`);
      }

      if (diagnostics.length > 0) {
        console.log('');
        reportDiagnostics(diagnostics);
        console.log(`\nFAIL — ${diagnostics.length} record(s) do not match their Lexicon.`);
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
