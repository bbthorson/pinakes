/**
 * Lint rules for `character.stretch` records.
 *
 * These run against *compiled* records rather than frontmatter, because the rule
 * that matters most — `stretch-source-future` — needs every other record's
 * dates, and those only exist once the compiler has built scenes, state events,
 * posts, and custody events. The compiler computes the findings; `pinakes lint`
 * reports them, honouring each rule's configured severity. `pinakes compile`
 * does not, for the same reason it does not run `post-register`: compile fails
 * on structure (resolution, Lexicon validation), lint fails on continuity.
 */
import { Config } from '../config.js';
import { Diagnostic } from './engine.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date, not merely the right shape — `2026-02-30` fails. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * When each citable record *ends*, keyed by id. `null` means the record is
 * undated (a profile, place, or item: long-tier material, citable at any date).
 *
 * The end, not the start, is what matters: a chapter dated `2026-10-12 to
 * 2026-10-14` has two days still to run on Oct 12, and a stretch written on
 * Oct 12 cannot know how they went.
 */
export type SourceIndex = Map<string, string | null>;

/** A compiled stretch plus the bits of its source file the lints need. */
export interface StretchEntry {
  record: Record<string, any>;
  folder: string;
  fileName: string;
  /** The character slug the record resolved to, e.g. `emma`. */
  slug: string;
}

export function lintStretches(
  entries: StretchEntry[],
  index: SourceIndex,
  registers: string[],
  config: Config
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const severityOf = (rule: string, fallback: 'error' | 'warning'): 'error' | 'warning' | null => {
    const set = config.rules[rule] ?? fallback;
    return set === 'off' ? null : set;
  };
  const report = (rule: string, fallback: 'error' | 'warning', file: string, message: string) => {
    const severity = severityOf(rule, fallback);
    if (severity) out.push({ file, rule, severity, message });
  };

  const seen = new Map<string, string>(); // subject::asOf -> first file

  for (const { record: r, folder, fileName, slug } of entries) {
    const file: string = r.sourceFile;

    // Dates
    const asOfOk = isCalendarDate(r.asOf);
    const sinceOk = isCalendarDate(r.since);
    if (!asOfOk) report('stretch-dates', 'error', file, `\`asOf\` must be a YYYY-MM-DD calendar date; got '${r.asOf ?? ''}'.`);
    if (!sinceOk) report('stretch-dates', 'error', file, `\`since\` must be a YYYY-MM-DD calendar date; got '${r.since ?? ''}'.`);
    if (asOfOk && sinceOk && r.since > r.asOf) {
      report('stretch-dates', 'error', file, `\`since\` (${r.since}) is after \`asOf\` (${r.asOf}); a stretch looks backward.`);
    }

    // Filename and folder
    const expectedName = `${r.asOf}.md`;
    if (folder !== slug || fileName !== expectedName) {
      report(
        'stretch-filename',
        'error',
        file,
        `A stretch for ${r.subject} as of ${r.asOf ?? '?'} belongs at \`stretches/${slug}/${expectedName}\`.`
      );
    }

    // One per character per date
    if (asOfOk) {
      const key = `${r.subject}::${r.asOf}`;
      const first = seen.get(key);
      if (first) {
        report('stretch-duplicate', 'error', file, `${r.subject} already has a stretch as of ${r.asOf} (${first}).`);
      } else {
        seen.set(key, file);
      }
    }

    // Status
    if (r.status !== 'draft' && r.status !== 'approved') {
      report('stretch-status', 'error', file, `\`status\` must be 'draft' or 'approved'; got '${r.status ?? ''}'.`);
    }

    // Register vocabulary
    if (!registers.includes(r.register)) {
      report(
        'stretch-register',
        'error',
        file,
        `Register '${r.register ?? ''}' is not in the vocabulary (${registers.map((x) => `'${x}'`).join(', ')}).`
      );
    }

    // Sources: resolve, then check none ends after asOf.
    const sources: unknown[] = Array.isArray(r.sources) ? r.sources : [];
    for (const src of sources) {
      const id = String(src);
      if (!index.has(id)) {
        report(
          'stretch-source-unresolved',
          'error',
          file,
          `Source '${id}' is not a compiled record id. Stretches cite posts, state events, scenes, custody events, profiles, places, or items.`
        );
        continue;
      }
      const end = index.get(id);
      if (asOfOk && end && end > r.asOf) {
        report(
          'stretch-source-future',
          'error',
          file,
          `Source '${id}' ends ${end}, after this stretch's asOf ${r.asOf}. A character cannot draw on what has not happened yet.`
        );
      }
    }

    // Length
    const softMax = config.stretches.softMaxChars;
    if (typeof r.state === 'string' && r.state.length > softMax) {
      report(
        'stretch-length',
        'warning',
        file,
        `Stretch is ${r.state.length} characters, over the ${softMax} soft limit. A stretch is a paragraph, not a summary.`
      );
    }
  }

  return out;
}

