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
/** A real calendar date, not merely the right shape — `2026-02-30` fails. */
export declare function isCalendarDate(value: unknown): value is string;
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
export declare function lintStretches(entries: StretchEntry[], index: SourceIndex, registers: string[], config: Config): Diagnostic[];
