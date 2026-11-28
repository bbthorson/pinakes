/**
 * Chapter split / renumber helper (`pinakes renumber`).
 *
 * Safely shifts chapter filenames (`NN.md`, `NN_slug.md`, `chNN_slug.md`),
 * frontmatter `chapter:` numbers, and `#`/`###` `Chapter <Word>` (or numeric)
 * headings for every chapter `>= from` by `delta` (`+1` or `-1`, etc.).
 *
 * Also scans `audit_notes`, `00_story_outline.md`, and `tracking/*.md` inside
 * the story directory and reports any stale `Ch N` / `ChN` references whose
 * chapter number is `>= from`.
 */
import fs from 'fs';
import path from 'path';
import type { LinterEngine } from './linter/engine.js';
import { getBookKeyFromDir } from './compiler/first-appearances.js';

export interface RenumberOptions {
  story: string;
  from: number;
  delta: number;
  dryRun?: boolean;
}

export interface RenumberFileChange {
  oldFile: string;
  newFile: string;
  oldChapter: number;
  newChapter: number;
  headingsUpdated: number;
}

export interface StaleChapterReference {
  file: string;
  line: number;
  match: string;
  chapterNum: number;
  suggestedNum: number;
  snippet: string;
}

export interface RenumberResult {
  storyDir: string;
  from: number;
  delta: number;
  dryRun: boolean;
  changes: RenumberFileChange[];
  staleReferences: StaleChapterReference[];
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** Converts an integer in [1, 199] to Title-Case English words (e.g. 21 -> "Twenty-One"). */
export function numberToChapterWord(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 199) return null;
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
  }
  const rem = n - 100;
  if (rem === 0) return 'One Hundred';
  const rest = numberToChapterWord(rem);
  return rest ? `One Hundred ${rest}` : null;
}

const WORD_TO_NUM = new Map<string, number>();
for (let i = 1; i <= 199; i++) {
  const w = numberToChapterWord(i);
  if (w) {
    WORD_TO_NUM.set(w.toLowerCase(), i);
    WORD_TO_NUM.set(w.toLowerCase().replace(/-/g, ' '), i);
  }
}

export function chapterWordToNumber(word: string): number | null {
  const norm = word.trim().toLowerCase().replace(/\s+/g, ' ');
  return WORD_TO_NUM.get(norm) ?? null;
}

function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return replacement.toUpperCase();
  }
  if (source === source.toLowerCase()) {
    return replacement.toLowerCase();
  }
  return replacement;
}

/**
 * Shifts the numeric chapter token in a filename while preserving prefix,
 * suffix, and zero-padding width:
 *   `05.md` -> `06.md`
 *   `05_the_dinner.md` -> `06_the_dinner.md`
 *   `ch05_dinner.md` -> `ch06_dinner.md`
 */
export function shiftChapterFilename(fileName: string, oldNum: number, newNum: number): string {
  const m = fileName.match(/^(chapter[_-]?|ch[_-]?)?(\d+)([_.-].*|\.md)$/i);
  if (!m) return fileName;
  const prefix = m[1] ?? '';
  const digits = m[2];
  const rest = m[3];
  if (parseInt(digits, 10) !== oldNum) return fileName;
  const padWidth = Math.max(digits.length, 2);
  const nextDigits = digits.length >= 2 ? String(newNum).padStart(padWidth, '0') : String(newNum);
  return `${prefix}${nextDigits}${rest}`;
}

/**
 * Updates `chapter:` inside the YAML frontmatter block and any `#`/`###`
 * `Chapter <Word>` or `Chapter <Num>` headings in the prose body whose number
 * matches `oldNum`.
 */
export function rewriteChapterContent(
  content: string,
  oldNum: number,
  newNum: number
): { content: string; headingsUpdated: number } {
  const lines = content.split(/\r?\n/);
  const eol = content.includes('\r\n') ? '\r\n' : '\n';

  let fmClose = -1;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        fmClose = i;
        break;
      }
    }
  }

  // 1. Update `chapter:` in frontmatter, preserving quotes/padding/comments.
  if (fmClose > 0) {
    for (let i = 1; i < fmClose; i++) {
      const m = lines[i].match(/^(\s*chapter\s*:\s*)(["']?)(\d+)\2(.*)$/);
      if (m && parseInt(m[3], 10) === oldNum) {
        const padded = m[3].length >= 2 && m[3].startsWith('0')
          ? String(newNum).padStart(m[3].length, '0')
          : String(newNum);
        lines[i] = `${m[1]}${m[2]}${padded}${m[2]}${m[4]}`;
        break;
      }
    }
  }

  // 2. Update `#`..`######` headings like `# Chapter Five`, `### Chapter Twenty-One: Title`, `# Chapter 5`
  const newWord = numberToChapterWord(newNum);
  let headingsUpdated = 0;
  const startBody = fmClose > 0 ? fmClose + 1 : 0;

  for (let i = startBody; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6}\s+)(chapter)(\s+)(.+)$/i);
    if (!headingMatch) continue;

    const [, hashes, chapWord, space, rest] = headingMatch;

    // Numeric heading: `# Chapter 5` or `### Chapter 05 — Title`
    const numMatch = rest.match(/^(\d+)(\b.*)$/);
    if (numMatch && parseInt(numMatch[1], 10) === oldNum) {
      const padded = numMatch[1].length >= 2 && numMatch[1].startsWith('0')
        ? String(newNum).padStart(numMatch[1].length, '0')
        : String(newNum);
      lines[i] = `${hashes}${chapWord}${space}${padded}${numMatch[2]}`;
      headingsUpdated++;
      continue;
    }

    // Word heading: `# Chapter Five`, `### Chapter Twenty-One: The Dinner`
    if (newWord) {
      // Match up to 3 word tokens (covers "One Hundred Twenty-One" and "Twenty-One" and "Five")
      const wordMatch = rest.match(/^([A-Za-z]+(?:[- ][A-Za-z]+){0,2})(?=[\s:—–\-.,!?]|$)(.*)$/);
      if (wordMatch) {
        const candidate = wordMatch[1];
        const parts = candidate.split(/(?=[ -])/);
        // Try longest prefix that parses as `oldNum` (so "Five Steps" only replaces "Five").
        for (let len = parts.length; len >= 1; len--) {
          const prefix = parts.slice(0, len).join('');
          if (chapterWordToNumber(prefix) === oldNum) {
            const trailing = candidate.slice(prefix.length) + wordMatch[2];
            lines[i] = `${hashes}${chapWord}${space}${matchCase(prefix, newWord)}${trailing}`;
            headingsUpdated++;
            break;
          }
        }
      }
    }
  }

  return { content: lines.join(eol), headingsUpdated };
}

function collectMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function findReferenceScanFiles(storyDir: string): string[] {
  const files = new Set<string>();

  // 00_story_outline.md in common locations
  for (const rel of ['00_story_outline.md', path.join('chapters', '00_story_outline.md'), path.join('plot', '00_story_outline.md')]) {
    const abs = path.join(storyDir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.add(abs);
  }

  // audit_notes (file or directory at story root or under tracking/)
  for (const entry of fs.existsSync(storyDir) ? fs.readdirSync(storyDir).sort() : []) {
    if (!entry.toLowerCase().startsWith('audit_notes')) continue;
    const abs = path.join(storyDir, entry);
    const stat = fs.statSync(abs);
    if (stat.isFile()) files.add(abs);
    else if (stat.isDirectory()) {
      for (const f of collectMarkdownFiles(abs)) files.add(f);
    }
  }

  // tracking/**/*.md
  const trackingDir = path.join(storyDir, 'tracking');
  if (fs.existsSync(trackingDir) && fs.statSync(trackingDir).isDirectory()) {
    for (const f of collectMarkdownFiles(trackingDir)) files.add(f);
  }

  return [...files].sort();
}

const STALE_CH_REF_RE = /\b(?:Ch\.?\s*|Chapter\s+)(\d+)\b/gi;

export function scanStaleChapterReferences(
  projectRoot: string,
  storyDir: string,
  from: number,
  delta: number
): StaleChapterReference[] {
  const refs: StaleChapterReference[] = [];
  for (const abs of findReferenceScanFiles(storyDir)) {
    const rel = path.relative(projectRoot, abs);
    const lines = fs.readFileSync(abs, 'utf-8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(STALE_CH_REF_RE)) {
        const num = parseInt(m[1], 10);
        if (Number.isFinite(num) && num >= from) {
          refs.push({
            file: rel,
            line: i + 1,
            match: m[0],
            chapterNum: num,
            suggestedNum: num + delta,
            snippet: line.trim(),
          });
        }
      }
    }
  }
  return refs;
}

export function renumberChapters(
  projectRoot: string,
  engine: LinterEngine,
  options: RenumberOptions
): RenumberResult {
  const { story, from, delta, dryRun = false } = options;

  if (!Number.isInteger(from) || from < 1) {
    throw new Error(`--from must be a positive integer; got '${from}'.`);
  }
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`--delta must be a non-zero integer (e.g. +1 or -1); got '${delta}'.`);
  }

  const needle = story.toLowerCase();
  const stories = engine.getStories();
  const storyDir =
    stories.find((s) => path.basename(s).toLowerCase() === needle || getBookKeyFromDir(s) === needle) ??
    stories.find((s) => path.basename(s).toLowerCase().includes(needle));
  if (!storyDir) {
    throw new Error(`Story '${story}' did not match any story directory.`);
  }

  const chapters = engine.loadChapters(storyDir);
  const numericChapters = chapters.filter((c): c is typeof c & { chapterNum: number } => typeof c.chapterNum === 'number');
  const toShift = numericChapters.filter((c) => c.chapterNum >= from);
  const unshifted = numericChapters.filter((c) => c.chapterNum < from);

  const unshiftedPaths = new Set(unshifted.map((c) => path.resolve(c.filePath)));
  const unshiftedNums = new Set(unshifted.map((c) => c.chapterNum));

  // Pre-validate all target chapter numbers and target file paths before touching disk.
  const planned = toShift.map((ch) => {
    const newChapter = ch.chapterNum + delta;
    if (newChapter < 1) {
      throw new Error(
        `Cannot shift Chapter ${ch.chapterNum} (${ch.relativeFilePath}) by ${delta}: resulting chapter number ${newChapter} is < 1.`
      );
    }
    if (unshiftedNums.has(newChapter)) {
      throw new Error(
        `Cannot shift Chapter ${ch.chapterNum} to Chapter ${newChapter}: Chapter ${newChapter} already exists and is not being shifted.`
      );
    }
    const dir = path.dirname(ch.filePath);
    const oldBase = path.basename(ch.filePath);
    const newBase = shiftChapterFilename(oldBase, ch.chapterNum, newChapter);
    const newPath = path.join(dir, newBase);
    if (unshiftedPaths.has(path.resolve(newPath))) {
      throw new Error(
        `Cannot rename ${ch.relativeFilePath} to ${path.relative(projectRoot, newPath)}: target file already exists.`
      );
    }
    const raw = fs.readFileSync(ch.filePath, 'utf-8');
    const rewritten = rewriteChapterContent(raw, ch.chapterNum, newChapter);
    return {
      ch,
      oldPath: ch.filePath,
      newPath,
      oldChapter: ch.chapterNum,
      newChapter,
      newContent: rewritten.content,
      headingsUpdated: rewritten.headingsUpdated,
    };
  });

  // Safe rename order: descending when shifting up (+), ascending when shifting down (-).
  const ordered = [...planned].sort((a, b) =>
    delta > 0 ? b.oldChapter - a.oldChapter : a.oldChapter - b.oldChapter
  );

  if (!dryRun) {
    for (const item of ordered) {
      fs.writeFileSync(item.oldPath, item.newContent, 'utf-8');
      if (item.oldPath !== item.newPath) {
        fs.renameSync(item.oldPath, item.newPath);
      }
    }
  }

  const changes: RenumberFileChange[] = planned
    .sort((a, b) => a.oldChapter - b.oldChapter)
    .map((p) => ({
      oldFile: path.relative(projectRoot, p.oldPath),
      newFile: path.relative(projectRoot, p.newPath),
      oldChapter: p.oldChapter,
      newChapter: p.newChapter,
      headingsUpdated: p.headingsUpdated,
    }));

  const staleReferences = scanStaleChapterReferences(projectRoot, storyDir, from, delta);

  return {
    storyDir: path.relative(projectRoot, storyDir),
    from,
    delta,
    dryRun,
    changes,
    staleReferences,
  };
}
