/**
 * The as-of bundle: what a character can see on one story date.
 *
 * Every tier looks backward. A character knows what has happened to them and
 * not what the author has planned, so everything here has ended on or before
 * `asOf` — the same horizon `stretch-source-future` enforces on stretches. The
 * bundle exists so that whoever drafts in a character's voice (an author, or a
 * model) is handed that horizon rather than trusted to keep to it.
 *
 * Three tiers, plus the record of what the character did in public:
 *
 * - **Long:** the codex file, cut to the headings `context.codex` allows. Fails
 *   closed: nothing is shown unless included, and held material is removed by
 *   heading or by paragraph prefix. What was withheld is counted, never named —
 *   a heading like "The Online Life" is itself a disclosure.
 * - **Mid:** the latest approved stretch with `asOf` on or before the date.
 * - **Short:** state events whose span covers the date. By default only the
 *   register expression, not the annotation: annotations are written about the
 *   character by an author who knows the whole book, and routinely carry things
 *   the character does not know. `fullState` opts in, with a warning.
 * - **History:** the character's posts, the posts they replied to, and the posts
 *   that mention them, all dated on or before `asOf`; and the scenes they were
 *   present for that have ended, by title only.
 */
import fs from 'fs';
import path from 'path';
import { Config } from '../config.js';
import { Registry } from '../registry/entities.js';
import { LinterEngine } from '../linter/engine.js';
import { isCalendarDate } from '../linter/stretches.js';
import { namesUnendedChapter } from './chapter-refs.js';
import { daysBetween, formatAffectPromptInjection, getBehavioralDirectives } from '../compiler/affect.js';
import { computeAffectState, type AffectState, type AffectTraitProblem } from '../compiler/affect-dynamics.js';

export interface CodexSection {
  heading: string;
  level: number;
  text: string;
}

export interface ContextBundle {
  character: { id: string; displayName: string };
  asOf: string;
  affect?: {
    /** The stretch record the state starts from. */
    snapshot?: Record<string, any>;
    promptBlock?: string;
    state?: AffectState;
    /** The character's codex affect fields are invalid, so no state was computed. */
    problems?: AffectTraitProblem[];
  };
  long: {
    frontmatter: Record<string, string>;
    sections: CodexSection[];
    /** Sections and paragraphs removed by configuration. A count, never names. */
    withheld: number;
    configured: boolean;
  };
  mid: {
    latest?: Record<string, any>;
    earlier: string[];
    draftsIgnored: number;
  };
  short: {
    id: string;
    storyDate: string;
    storyDateEnd?: string;
    register: string;
    registerExpr?: string;
    state?: string;
  }[];
  history: {
    posts: { id: string; author: string; storyDate: string; storyTime?: string; inReplyTo?: string; text: string }[];
    scenes: { id: string; storyDate: string; storyDateEnd?: string; title: string }[];
  };
  fullState: boolean;
}

export interface BuildResult {
  bundle?: ContextBundle;
  errors: string[];
}

export { chapterRefs, namesUnendedChapter, type ChapterRef } from './chapter-refs.js';

function matches(heading: string, patterns: string[]): boolean {
  const h = heading.trim().toLowerCase();
  return patterns.some((p) => h.startsWith(p.trim().toLowerCase()));
}

/**
 * Cuts a codex body to the allowed headings.
 *
 * The level-1 title is never shown (the bundle names the character itself).
 * Content before the first heading is not under any included heading, so it is
 * not shown either. `withholdParagraph` is applied to headings as well as
 * paragraphs: a heading like "After Chapter 20" withholds its whole section,
 * subsections included, because the heading says what the section is about.
 */
export function cutCodex(
  body: string,
  include: string[],
  exclude: string[],
  excludeParagraphs: string[],
  /** Extra paragraph test; `true` withholds. Used for the chapter horizon. */
  withholdParagraph: (text: string) => boolean = () => false
): { sections: CodexSection[]; withheld: number; unmatchedExcludes: string[] } {
  const lines = body.split(/\r?\n/);
  /** `held`: this heading names the future, so everything under it is withheld. */
  const stack: { level: number; text: string; held: boolean }[] = [];
  const sections: CodexSection[] = [];
  const headingsSeen: string[] = [];
  let withheld = 0;
  let current: { heading: string; level: number; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    // Paragraph-level withholding: blank-line-separated blocks whose first line
    // starts with a configured prefix.
    const paragraphs: string[][] = [];
    let para: string[] = [];
    for (const line of current.lines) {
      if (line.trim() === '') {
        if (para.length) paragraphs.push(para);
        para = [];
      } else {
        para.push(line);
      }
    }
    if (para.length) paragraphs.push(para);

    const kept = paragraphs.filter((p) => {
      const drop =
        excludeParagraphs.some((prefix) => p[0].trim().startsWith(prefix)) || withholdParagraph(p.join('\n'));
      if (drop) withheld++;
      return !drop;
    });
    sections.push({ heading: current.heading, level: current.level, text: kept.map((p) => p.join('\n')).join('\n\n') });
    current = null;
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) {
      flush();
      const level = m[1].length;
      const text = m[2];
      headingsSeen.push(text);
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const held = level > 1 && withholdParagraph(text);
      stack.push({ level, text, held });

      if (level === 1) continue;
      const included = stack.some((h) => matches(h.text, include));
      const withholds = (h: { text: string; held: boolean }) => h.held || matches(h.text, exclude);
      if (included && stack.some(withholds)) {
        // Count only the outermost heading that triggered the withholding, not
        // each subsection under it, so the count reads as "sections withheld".
        if (!stack.slice(0, -1).some(withholds)) withheld++;
        continue;
      }
      if (included) current = { heading: text, level, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  const unmatchedExcludes = exclude.filter((p) => !headingsSeen.some((h) => matches(h, [p])));
  return { sections, withheld, unmatchedExcludes };
}

export function buildContext(
  root: string,
  config: Config,
  registry: Registry,
  engine: LinterEngine,
  records: any[],
  characterName: string,
  asOf: string,
  options: { fullState?: boolean } = {}
): BuildResult {
  const errors: string[] = [];
  const NS = config.project.nsid;

  const resolved = registry.resolve(characterName, 'character');
  if (!resolved) errors.push(`'${characterName}' does not resolve to a registry character.`);
  if (!isCalendarDate(asOf)) errors.push(`--as-of must be a YYYY-MM-DD calendar date; got '${asOf}'.`);
  if (!resolved || errors.length) return { errors };

  const id = resolved.id;
  const entity = registry.allEntities.find((e) => e.id === id);
  const displayName = entity?.displayName ?? id;

  // Per-character exclusions are keyed by registry name; resolve them all, so a
  // typo'd name fails rather than silently withholding nothing.
  const excludeFor: string[] = [];
  for (const [name, headings] of Object.entries(config.context.codex.exclude)) {
    const hit = registry.resolve(name, 'character');
    if (!hit) {
      errors.push(`context.codex.exclude names '${name}', which does not resolve to a registry character.`);
      continue;
    }
    if (hit.id === id) excludeFor.push(...headings);
  }

  const typed = (t: string) => records.filter((r) => r.$type === `${NS}.${t}`);
  const ends = (r: any): string => r.storyDateEnd ?? r.storyDate;

  // Chapter horizon: when each chapter ends, per book, from the scene records.
  const chapterEnds = new Map<string, Map<number, string>>();
  for (const s of typed('scene')) {
    const m = String(s.id).match(/^scene\.(.+)\.ch(\d+)$/);
    if (!m) continue;
    const perBook = chapterEnds.get(m[1]) ?? new Map<number, string>();
    const n = parseInt(m[2], 10);
    const end = ends(s);
    if (!perBook.has(n) || end > perBook.get(n)!) perBook.set(n, end);
    chapterEnds.set(m[1], perBook);
  }
  const unended = (text: string) => namesUnendedChapter(text, asOf, chapterEnds);

  // Long tier
  const codexCfg = config.context.codex;
  const frontmatter: Record<string, string> = {};
  let sections: CodexSection[] = [];
  let withheld = 0;
  const srcFile = entity?.sourceFile ? path.resolve(root, entity.sourceFile) : '';
  if (srcFile && fs.existsSync(srcFile)) {
    const parsed = engine.parseFrontmatter(fs.readFileSync(srcFile, 'utf-8'));
    for (const key of codexCfg.frontmatter) {
      const v = parsed.data?.[key];
      if (v === undefined || v === null || typeof v === 'object') continue;
      if (unended(String(v))) {
        withheld++;
        continue;
      }
      frontmatter[key] = String(v);
    }
    const cut = cutCodex(parsed.body, codexCfg.include, excludeFor, codexCfg.excludeParagraphs, unended);
    sections = cut.sections;
    withheld += cut.withheld;
    // The unmatched heading text is deliberately not printed: naming a held
    // section is itself a disclosure. The count and the file are enough to act on.
    if (cut.unmatchedExcludes.length > 0) {
      errors.push(
        `context.codex.exclude for ${displayName} has ${cut.unmatchedExcludes.length} heading(s) not found in ` +
          `${entity?.sourceFile}. A renamed heading would stop being withheld, so this is an error.`
      );
    }
  }
  if (errors.length) return { errors };

  // Mid tier
  const stretches = typed('character.stretch')
    .filter((r) => r.subject === id && typeof r.asOf === 'string' && r.asOf <= asOf)
    .sort((a, b) => a.asOf.localeCompare(b.asOf));
  const approved = stretches.filter((r) => r.status === 'approved');
  const latest = approved[approved.length - 1];

  // Short tier
  const short = typed('character.stateEvent')
    .filter((r) => r.subject === id && r.storyDate <= asOf && asOf <= ends(r))
    .map((r) => ({
      id: r.id,
      storyDate: r.storyDate,
      storyDateEnd: r.storyDateEnd,
      register: r.register,
      registerExpr: r.registerExpr,
      state: options.fullState ? r.state : undefined,
    }));

  // History
  // An undated post compares '' <= asOf and would pass the horizon; fail closed.
  const posts = typed('character.post').filter((p) => isCalendarDate(p.storyDate) && p.storyDate <= asOf);
  const repliedTo = new Set(posts.filter((p) => p.author === id && p.inReplyTo).map((p) => p.inReplyTo));
  const history = posts
    .filter((p) => p.author === id || repliedTo.has(p.id) || (p.mentions ?? []).includes(id))
    .sort((a, b) => a.storyDate.localeCompare(b.storyDate) || String(a.storyTime ?? '').localeCompare(String(b.storyTime ?? '')))
    .map((p) => ({ id: p.id, author: p.author, storyDate: p.storyDate, storyTime: p.storyTime, inReplyTo: p.inReplyTo, text: p.text ?? '' }));

  const scenes = typed('scene')
    .filter((s) => (s.participants ?? []).includes(id) && ends(s) <= asOf)
    .sort((a, b) => a.storyDate.localeCompare(b.storyDate) || a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((s) => ({ id: s.id, storyDate: s.storyDate, storyDateEnd: s.storyDateEnd, title: s.title }));

  // Only a stretch that declared its affect has coordinates (the compiler
  // never infers them), so this needs no special case to stay silent for one
  // that did not. `context.affect: off` silences it regardless, and skips the
  // replay entirely.
  let affect: ContextBundle['affect'];
  if (config.context.affect !== 'off') {
    const { state, problems } = computeAffectState(root, config, registry, engine, records, id, asOf);
    if (problems.length) {
      affect = { problems };
    } else if (state?.attractorBasin) {
      const trace: string[] = [];
      if (state.mode !== 'declared') {
        trace.push(`ANCHOR: ${state.anchor.id}`);
        for (const e of state.events) trace.push(`EVENT: ${e.id} (ended ${e.end}, ${daysBetween(e.end, asOf)} days before)`);
        trace.push(
          state.mode === 'replayed'
            ? `DECAY: half-life ${state.halfLifeDays} days toward baseline`
            : 'DECAY: not decaying: no baseline'
        );
      }
      affect = {
        snapshot: records.find((r) => r.id === state.anchor.id),
        state,
        promptBlock: formatAffectPromptInjection({
          coordinates: state.coordinates,
          attractorBasin: state.attractorBasin,
          behavioralDirectives: getBehavioralDirectives(state.attractorBasin, config.affect.basins),
          trace,
        }),
      };
    } else if (state) {
      affect = { snapshot: records.find((r) => r.id === state.anchor.id), state };
    }
  }

  return {
    errors: [],
    bundle: {
      character: { id, displayName },
      asOf,
      affect,
      long: { frontmatter, sections, withheld, configured: codexCfg.include.length > 0 },
      mid: {
        latest,
        earlier: approved.slice(0, -1).map((r) => r.id),
        draftsIgnored: stretches.length - approved.length,
      },
      short,
      history: { posts: history, scenes },
      fullState: Boolean(options.fullState),
    },
  };
}

export function renderMarkdown(b: ContextBundle): string {
  const out: string[] = [];
  out.push(`# ${b.character.displayName} — as of ${b.asOf}`);
  out.push('');
  out.push(
    `Everything below had ended on or before ${b.asOf}. Nothing later is included: ` +
      `${b.character.displayName} does not know it yet.`
  );

  out.push('', '## Long tier: who they are', '');
  if (!b.long.configured) {
    out.push('_No codex headings are configured in `context.codex.include`, so the long tier is withheld entirely._');
  } else {
    for (const [k, v] of Object.entries(b.long.frontmatter)) out.push(`- **${k}:** ${v}`);
    if (Object.keys(b.long.frontmatter).length) out.push('');
    for (const s of b.long.sections) {
      out.push(`${'#'.repeat(Math.min(s.level + 1, 6))} ${s.heading}`);
      if (s.text) out.push('', s.text);
      out.push('');
    }
  }
  if (b.long.withheld > 0) {
    out.push(`_${b.long.withheld} codex section(s) or paragraph(s) withheld by configuration._`);
  }

  out.push('', '## Mid tier: the recent stretch', '');
  const l = b.mid.latest;
  if (l) {
    out.push(`**${l.id}** — since ${l.since}, register \`${l.register}\``, '');
    out.push(l.state, '');
    if (l.carrying?.length) {
      out.push('Carrying:');
      for (const c of l.carrying) out.push(`- ${c}`);
      out.push('');
    }
    if (b.mid.earlier.length) out.push(`Earlier stretches: ${b.mid.earlier.join(', ')}`, '');
  } else {
    out.push('_No approved stretch on or before this date._', '');
  }
  if (b.mid.draftsIgnored > 0) out.push(`_${b.mid.draftsIgnored} draft stretch(es) ignored; only approved ones are shown._`, '');

  if (b.affect?.promptBlock) {
    out.push('## Affect state (advisory — the voice guide and register win on any conflict)', '');
    out.push('```', b.affect.promptBlock, '```', '');
  } else if (b.affect?.problems?.length) {
    out.push('## Affect state', '');
    for (const p of b.affect.problems) out.push(`_Not computed: ${p.file}: ${p.message} Run \`pinakes lint\`._`);
    out.push('');
  }

  out.push('## Short tier: right now', '');
  if (b.short.length === 0) {
    out.push('_Off-page today: no scene covers this date._');
  } else {
    if (b.fullState) {
      out.push(
        '> **Annotations included (`--full-state`).** These are written about the character by an author who ' +
          'knows the whole book, and may contain things the character does not know.',
        ''
      );
    }
    for (const e of b.short) {
      const span = e.storyDateEnd ? `${e.storyDate} to ${e.storyDateEnd}` : e.storyDate;
      out.push(`- ${e.id} (${span}): \`${e.registerExpr ?? e.register}\`${e.state ? ` — ${e.state}` : ''}`);
    }
  }

  out.push('', '## History: what they have seen and said', '');
  if (b.history.scenes.length) {
    out.push('Scenes they were present for:');
    for (const s of b.history.scenes) {
      const span = s.storyDateEnd ? `${s.storyDate} to ${s.storyDateEnd}` : s.storyDate;
      out.push(`- ${s.id} (${span}): ${s.title}`);
    }
    out.push('');
  }
  if (b.history.posts.length) {
    out.push('Posts:');
    for (const p of b.history.posts) {
      const when = p.storyTime ? `${p.storyDate} ${p.storyTime}` : p.storyDate;
      const reply = p.inReplyTo ? ` (reply to ${p.inReplyTo})` : '';
      out.push(`- **${p.id}**, ${p.author}, ${when}${reply}`);
      out.push(...p.text.split('\n').map((line) => `  > ${line}`));
    }
  }
  if (!b.history.scenes.length && !b.history.posts.length) out.push('_Nothing yet._');

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
