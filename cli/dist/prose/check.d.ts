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
export declare const DEFAULT_SIGNALS: Signal[];
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
export declare function hasSpeech(paragraph: string): boolean;
export declare function reportTells(chapters: ChapterData[], config: Config): string;
/**
 * Every chapter's final paragraph, in order, in one file.
 *
 * This is a reading aid, not a detector, and the report says so in its own text.
 * The taxonomy states the epiphany-button close has zero mechanical signal: the
 * tell is sameness of move across chapters, which only exists at the level of
 * the whole set. Assembly is the value. The `SHORT` flag is a footnote on it.
 */
export declare function reportClosers(chapters: ChapterData[], config: Config): string;
export type ProseReport = 'tells' | 'closers';
/** The requested reports as Markdown, keyed by report name. Nothing is printed or written. */
export declare function buildProseReports(chapters: ChapterData[], config: Config, which: ProseReport | 'all'): Partial<Record<ProseReport, string>>;
