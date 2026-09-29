/**
 * Removes record files a previous compile wrote that this one did not.
 *
 * Compile only ever wrote files, so output from a book that was renamed or
 * deleted, a record type a book stopped producing (its last custody hand-off
 * cut), or an NSID that changed stayed in `records/` and kept being published.
 *
 * Only files pinakes itself names are candidates: the record files one level
 * below the output directory, and Lexicon documents in `lexicons/`. Anything
 * else an author keeps there is never touched.
 */
import fs from 'fs';
import path from 'path';
import { buildLexiconDocs } from '../lexicons/index.js';

/** Every record file name `compileProject` writes, in a book or `series/` directory. */
export const RECORD_FILES = new Set([
  'scenes.json',
  'character_state_events.json',
  'character_affect_events.json',
  'custody_events.json',
  'character_posts.json',
  'character_stretches.json',
  'places.json',
  'character_profiles.json',
  'items.json',
]);

/** Lexicon file suffixes, NSID authority removed: `.scene.json`, `.character.post.json`, ... */
const LEXICON_SUFFIXES = buildLexiconDocs('x').map((doc) => `${doc.id.slice('x'.length)}.json`);

const isLexiconFile = (name: string) => LEXICON_SUFFIXES.some((suffix) => name.endsWith(suffix));

/**
 * Deletes stale pinakes files under `outputDir` and returns their paths, or
 * `null` when it declined to prune.
 *
 * `written` holds the absolute paths this compile wrote. Pruning is skipped
 * when the output directory is the project root or contains it: there, a
 * `scenes.json` one level down could be the author's own file.
 */
export function pruneStale(projectRoot: string, outputDir: string, written: Set<string>): string[] | null {
  const root = path.resolve(projectRoot);
  const out = path.resolve(outputDir);
  const fromOut = path.relative(out, root);
  if (fromOut === '' || !fromOut.startsWith('..')) return null;
  if (!fs.existsSync(out)) return [];

  const removed: string[] = [];
  const remove = (file: string) => {
    fs.rmSync(file);
    removed.push(file);
  };

  for (const entry of fs.readdirSync(out, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(out, entry.name);
    const isLexicons = entry.name === 'lexicons';
    const before = removed.length;

    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      const ours = isLexicons ? isLexiconFile(file.name) : RECORD_FILES.has(file.name);
      const filePath = path.join(dir, file.name);
      if (ours && !written.has(filePath)) remove(filePath);
    }

    // A book directory emptied by pruning was a book that no longer exists. One
    // that was already empty is the author's, and stays.
    if (removed.length > before && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }

  return removed.sort();
}
