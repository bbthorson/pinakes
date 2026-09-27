/**
 * Writes docs/public/demo/records.json, the data behind the record browser
 * demo, by compiling a universe with this checkout's pinakes.
 *
 *   node scripts/sync-demo.mjs [path-to-universe]
 *
 * The default universe is a supper_club_secrets checkout next to this repository.
 *
 * It compiles rather than copying the universe's committed records/, so the
 * demo always shows what the current compiler emits, and it uses the library
 * API with `write: false`, so the universe itself is never touched. Build the
 * CLI first (`cd cli && npm run build`).
 *
 * The output is committed. The site build doesn't run this, because it would
 * need a second repository checked out.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, openUniverse } from '../../cli/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(here, '../../../supper_club_secrets'));
const target = path.join(here, '../public/demo/records.json');

const universe = openUniverse(root);
const { ok, diagnostics, records } = compile(universe);
// A demo of records that fail their own Lexicons would demonstrate the wrong thing.
if (!ok) {
  for (const d of diagnostics) console.error(`${d.file}: [${d.rule}] ${d.message}`);
  console.error(`\n${root} does not compile cleanly; not writing demo data.`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8' }).trim();
let commit = null;
try {
  commit = git('rev-parse', 'HEAD');
  if (git('status', '--porcelain', '--', 'codex', 'stories', 'pinakes.yaml')) {
    console.warn('Warning: the universe has uncommitted changes, so the recorded commit is not exactly what was compiled.');
  }
} catch {
  console.warn('Warning: not a git checkout; the demo will not name a source commit.');
}

const { version } = JSON.parse(fs.readFileSync(path.join(here, '../../cli/package.json'), 'utf-8'));

const data = {
  source: {
    name: universe.config.project.name,
    nsid: universe.config.project.nsid,
    // Scenes carry the grouping between book and chapter as `sequence`; this is its name here.
    sequenceName: universe.config.project.sequenceField,
    repo: 'https://github.com/bbthorson/supper_club_secrets',
    commit,
    pinakes: version,
  },
  records,
};

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(data) + '\n', 'utf-8');
console.log(`wrote ${records.length} records from ${universe.config.project.name} to ${path.relative(process.cwd(), target)}`);
