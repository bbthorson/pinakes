/**
 * Mechanical prose triage — the countable half of the AI-tells pre-pass that
 * `.claude/skills/story-audit/references/ai_tells.md` specifies.
 *
 * The taxonomy asks for counts before judgment ("Feels em-dash-heavy" is
 * worthless; "41 em-dashes across 12 chapters, 9 of them in Ch. 7" is a
 * finding), and it is explicit that **counts are inputs, not verdicts**. This
 * module produces the counts. Nothing here decides whether a number is a
 * problem, and nothing here is a pass/fail gate — `prose-check` deliberately
 * has no exit code tied to its findings, because gating on a judgment input
 * would contradict the taxonomy that defines it.
 *
 * Two reports:
 *
 *   tells    per-chapter counts for the signals the taxonomy lists, with every
 *            hard-signal hit quoted verbatim, plus the negative-parallelism
 *            classification trap kept open rather than papered over.
 *   closers  every chapter's final paragraph in one file, to be read together.
 *            The taxonomy records this tell as having zero mechanical signal;
 *            the report is an assembly aid, not a detector, and says so.
 */

import fs from 'fs';
import path from 'path';
import type { ChapterData } from '../linter/engine.js';
import type { Config } from '../config.js';

export interface Signal {
  label: string;
  pattern: string;
  note?: string;
}

/**
 * Verbatim from the taxonomy's mechanical pre-pass. A universe can add its own
 * signals or replace these through `prose.signals` in `pinakes.yaml`, but the
 * defaults are the catalogue itself, so the tool is useful before anyone
 * configures anything.
 *
 * Kept as label + pattern + note so that every number the report prints can say
 * what it is, and cannot be read as a verdict by accident.
 */
export const DEFAULT_SIGNALS: Signal[] = [
  {
    label: 'negative-parallelism',
    pattern: "not (just |merely |only )?[^.]{1,40}[\\u2014,] (it'?s|but) ",
    note: 'the corrective form; this is the classified count',
  },
  {
    label: "here's-the-kicker",
    pattern: "here'?s (the|where) (the )?(thing|kicker|catch|interesting|deal)|but here'?s",
  },
  {
    label: 'corporate-filler',
    pattern:
      '\\b(delve|leverage|unlock|elevate|testament|tapestry|landscape|ecosystem|symphony|realm|navigate the)\\b',
  },
  {
    label: 'magic-adverbs',
    pattern: '\\b(deeply|quietly|fundamentally|remarkably|profoundly|utterly|palpably)\\b',
    note: 'check against the voice guide before judging — a catalogued register is designed',
  },
  {
    label: 'somatic-beats',
    pattern: '\\b(jaw|breath|throat|chest|pulse|swallow\\w*|exhal\\w*)\\b',
    note: 'a proxy, not a detector — frequency only matters if the SAME beat repeats',
  },
];

/**
 * Which signals are rare and sharp enough that every hit is worth quoting in
 * full rather than tallying. A bare count invites the wrong call in both
 * directions: a `leverage` may sit inside a character's catalogued
 * jargon-for-laughs register (designed voice, not a tell), and an `unlock` may
 * be a literal door. Showing the line settles either in two seconds.
 */
const QUOTED_SIGNALS = new Set(['corporate-filler', "here's-the-kicker"]);

/**
 * The classification trap. A bare grep for sentence-initial "Not " sweeps in
 * participials ("Not wanting to hear them argue"), conditionals ("Not unless you
 * had a plan") and dialogue punchlines ("Not after the Debacle"). It is counted
 * separately, labelled unclassified, and never added to the signal above.
 */
const BARE_NOT = /(?:^|(?<=[.!?]\s))Not\s+\w/gm;

const DIALOGUE = /[“"]([^“”"]{2,})[”"]/g;

/**
 * Words in a string, for the counts the taxonomy asks for per chapter.
 *
 * Unicode-aware on purpose. JavaScript's `\w` is ASCII-only, so a `\w+` counter
 * reads "crème" as two words and "Éclair" as one-and-a-bit — which quietly
 * inflates every count in any universe whose prose carries accents, and can push
 * a closing paragraph across the short-closer threshold. Word counts here feed
 * an editorial judgment, so they have to be right for names as written.
 */
function words(text: string): number {
  return (text.match(/[\p{L}\p{N}_]+/gu) || []).length;
}

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

/**
 * Whether a paragraph contains quoted speech.
 *
 * Quote marks alone do not mean dialogue: narration scare-quotes phrases too (an
 * LLC name, a sign, the word one character uses for another's mood). A span is
 * speech when it completes a sentence, or when it breaks off on the comma or
 * dash that hands a fragment to its dialogue tag and opens like a sentence.
 * Trailing quote marks are stripped first so a line ending on a nested quotation
 * still reads as the speech it is.
 */
export function hasSpeech(paragraph: string): boolean {
  for (const m of paragraph.matchAll(DIALOGUE)) {
    const s = m[1].trim();
    if (/[.!?…]/.test(s)) return true;
    const tail = s.replace(/['"’”]+$/, '').trimEnd();
    if (/[,;:—–-]$/.test(tail) && !/^[a-z]/.test(s)) return true;
  }
  return false;
}

function signalsFor(config: Config): Signal[] {
  const configured = config.prose?.signals;
  return configured && configured.length > 0 ? configured : DEFAULT_SIGNALS;
}

// ------------------------------------------------------------------ tells

export function reportTells(chapters: ChapterData[], config: Config): string {
  const signals = signalsFor(config);
  const out: string[] = [
    '# Mechanical pre-pass',
    '',
    'Counts are **inputs, not verdicts** (`ai_tells.md` §mechanical pre-pass).',
    'The judgment pass decides which are genre-legitimate and which are fingerprints.',
    '',
    '| Ch | Words | em-dash /1k | ' + signals.map(s => s.label).join(' | ') + ' |',
    '| ---: | ---: | ---: | ' + signals.map(() => '---: ').join('| ') + '|',
  ];

  const totals: Record<string, number> = {};
  let totalWords = 0;
  let totalEm = 0;

  for (const ch of chapters) {
    const body = ch.body;
    const w = words(body);
    totalWords += w;
    const em = (body.match(/—/g) || []).length;
    totalEm += em;
    // One decimal always, so the column reads as a density and not an integer.
    const density = (w ? (em * 1000) / w : 0).toFixed(1);

    const row = [String(ch.chapterNum), String(w), density];
    for (const sig of signals) {
      const n = (body.match(new RegExp(sig.pattern, 'gi')) || []).length;
      totals[sig.label] = (totals[sig.label] || 0) + n;
      row.push(String(n));
    }
    out.push('| ' + row.join(' | ') + ' |');
  }

  out.push('');
  out.push(
    `**Book totals** — ${totalWords} words. ` +
      signals.map(s => `${s.label}: ${totals[s.label] || 0}`).join(', ') +
      `, em-dash: ${totalEm} (${(totalWords ? (totalEm * 1000) / totalWords : 0).toFixed(1)}/1k).`
  );
  out.push('');

  // Hard signals, quoted. See QUOTED_SIGNALS for why this is not a count.
  const hits: string[] = [];
  for (const ch of chapters) {
    for (const sig of signals) {
      if (!QUOTED_SIGNALS.has(sig.label)) continue;
      for (const m of ch.body.matchAll(new RegExp(sig.pattern, 'gi'))) {
        const a = Math.max(0, (m.index ?? 0) - 90);
        const b = Math.min(ch.body.length, (m.index ?? 0) + m[0].length + 90);
        const snippet = ch.body.slice(a, b).split(/\s+/).join(' ');
        hits.push(`- **Ch ${ch.chapterNum}** \`${sig.label}\` — …${snippet}…`);
      }
    }
  }
  out.push('## Hard-signal hits, verbatim', '');
  out.push(...(hits.length ? hits : ['_None._']));
  out.push('');

  // The classification trap, kept visible rather than folded into a number.
  const bare = chapters.reduce((n, ch) => n + (ch.body.match(BARE_NOT) || []).length, 0);
  const classified = totals['negative-parallelism'] || 0;
  out.push(
    '## Negative parallelism: the counting note',
    '',
    `- **${classified}** matches of the corrective form (\`not X — it's Y\`). This is the count that means something.`,
    `- **${bare}** sentence-initial \`Not …\` overall. This is **unclassified** and is not a tell count.`,
    '',
    'These two numbers are reported apart on purpose. A bare `Not ` grep over-counts —',
    'it sweeps in participials, conditionals and dialogue punchlines — and a pass that',
    'reads the unclassified figure as the tell count will report a tic the book does not',
    'have. Classify before you judge.',
    ''
  );

  // Carve-outs: terms a universe has catalogued as designed voice. The report
  // surfaces them for subtraction rather than suppressing them, so the judgment
  // pass sees both the raw count and the designed share.
  const carveOuts = config.prose?.carveOuts || [];
  if (carveOuts.length) {
    out.push('## Carve-outs this universe declares', '');
    for (const c of carveOuts) {
      let n = 0;
      for (const ch of chapters) {
        for (const para of paragraphs(ch.body)) {
          if (!para.toLowerCase().includes(c.term.toLowerCase())) continue;
          if (c.character && !new RegExp(`\\b${c.character}\\b`).test(para)) continue;
          n++;
        }
      }
      const scope = c.character ? ` in paragraphs naming ${c.character}` : '';
      out.push(`- **\`${c.term}\`**${scope}: **${n}**. ${c.note || ''} Subtract before judging the count above.`);
    }
    out.push('');
  }

  // Repeated-construction scan. The taxonomy calls this a worthwhile optional
  // extension and notes no fixed regex predicts it; distinctive 6-grams recurring
  // across different chapters are its mechanical shadow.
  const seen = new Map<string, Set<string>>();
  for (const ch of chapters) {
    const ws = ch.body.toLowerCase().match(/[a-z']+/g) || [];
    for (let i = 0; i + 6 <= ws.length; i++) {
      const gram = ws.slice(i, i + 6).join(' ');
      if (!seen.has(gram)) seen.set(gram, new Set());
      seen.get(gram)!.add(String(ch.chapterNum));
    }
  }
  const repeats = [...seen.entries()]
    .filter(([, chs]) => chs.size > 1)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, 15);
  out.push('## Repeated six-word constructions across chapters', '');
  if (repeats.length) {
    for (const [gram, chs] of repeats) {
      out.push(`- \`${gram}\` — ch ${[...chs].sort((x, y) => Number(x) - Number(y)).join(', ')}`);
    }
  } else {
    out.push('_None._');
  }
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------- closers

/**
 * Every chapter's final paragraph, in order, in one file.
 *
 * This is a reading aid, not a detector, and the report says so in its own text.
 * The taxonomy states the epiphany-button close has zero mechanical signal: the
 * tell is sameness of move across chapters, which only exists at the level of
 * the whole set. Assembly is the value. The `SHORT` flag is a footnote on it.
 */
export function reportClosers(chapters: ChapterData[], config: Config): string {
  const limit = config.prose?.closerMaxWords ?? 12;
  const out: string[] = [
    '# Chapter closers',
    '',
    "**Every chapter's final paragraph, in order, in one place — so they can be read",
    'together.** That is the whole point of this file. The taxonomy names the',
    'epiphany-button close as the most likely symmetry tell in a warm or resolving',
    'genre, and states that it has **zero mechanical signal**: no regex predicts it,',
    'because the tell is *sameness of move across chapters*, which only exists at the',
    'level of the whole set. Read them in one sitting and ask whether the book keeps',
    'landing the same tidy emotional bow.',
    '',
    '### About the `SHORT` flag',
    '',
    `\`SHORT\` marks a closer that is **narration-only and under ${limit} words** — the cheap`,
    'proxy from `ai_tells.md`, narrowed. A button is the narrator summarising what a',
    'scene meant, so a closer that ends on a line of speech is not one, whatever its',
    'length.',
    '',
    '**Do not read the flags as the finding.** Measured against a hand-identified set of',
    'buttons in a locked manuscript, this proxy agreed on three of seven, and the misses',
    'ran from 19 to 54 words — a 54-word closer was called a button by the human pass. ',
    'Length is not the axis the tell lives on, and no threshold repairs that. The flag is',
    'a nudge toward one end of the list. The judgment is the read.',
    '',
  ];

  for (const ch of chapters) {
    const paras = paragraphs(ch.body);
    const last = paras.length ? paras[paras.length - 1] : '';
    const n = words(last);
    const narration = !hasSpeech(last);
    const tag = narration && n < limit ? ' `SHORT`' : '';
    out.push(`### Ch ${ch.chapterNum} — ${ch.title} (${n} words)${tag}`, '', `> ${last}`, '');
  }
  return out.join('\n');
}

// -------------------------------------------------------------------- run

export function runProseCheck(
  chapters: ChapterData[],
  config: Config,
  which: string,
  outDir?: string
): void {
  const wanted = which === 'all' ? ['tells', 'closers'] : [which];
  const produced: Record<string, string> = {};
  for (const name of wanted) {
    produced[name] = name === 'tells' ? reportTells(chapters, config) : reportClosers(chapters, config);
  }

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, body] of Object.entries(produced)) {
      const file = path.join(outDir, `${name}.md`);
      fs.writeFileSync(file, body + '\n', 'utf-8');
      console.log(`wrote ${file}`);
    }
  } else {
    console.log(Object.values(produced).join('\n\n'));
  }
}
