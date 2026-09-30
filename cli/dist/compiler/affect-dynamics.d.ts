import { Config } from '../config.js';
import { Registry } from '../registry/entities.js';
import { LinterEngine } from '../linter/engine.js';
import { type ReplayEvent, type ScaledVad, type VadVector } from './affect.js';
/** What a character's codex frontmatter says about their affect. */
export interface AffectTraits {
    baseline?: VadVector;
    /** Multiplies the universe's half-life for this character. 1 when unset. */
    halfLifeScale: number;
}
export interface AffectTraitProblem {
    file: string;
    message: string;
}
/**
 * Reads `affectBaseline` and `affectHalfLifeScale` from a character's codex
 * file. A problem means the character is not replayed at all: a wrong rate or
 * a guessed baseline would produce a state that looks like data.
 */
export declare function readAffectTraits(projectRoot: string, sourceFile: string | null | undefined, engine: LinterEngine, vocab: Map<string, VadVector>): {
    traits?: AffectTraits;
    problems: AffectTraitProblem[];
};
/** A character's affect events as replay input, in replay order: end date, then book, then chapter. */
export declare function replayEvents(records: any[], NS: string, subject: string): (ReplayEvent & {
    sourceFile: string;
})[];
/** Approved stretches that declared affect, oldest first. Drafts neither anchor nor are checked. */
export declare function affectAnchors(records: any[], NS: string, subject: string): any[];
export interface AffectState {
    asOf: string;
    /**
     * `declared`: dynamics are off, and this is the latest stretch's affect as
     * written. `replayed`: carried forward through events, decaying toward the
     * baseline. `held`: carried forward, but with no baseline nothing decays.
     */
    mode: 'declared' | 'replayed' | 'held';
    coordinates: ScaledVad;
    attractorBasin?: string;
    /** The stretch the state starts from. */
    anchor: {
        id: string;
        asOf: string;
    };
    /** Events applied, oldest first. */
    events: {
        id: string;
        end: string;
    }[];
    halfLifeDays?: number;
}
export interface AffectStateResult {
    state?: AffectState;
    /** Why no state could be computed. The character's codex affect fields are invalid. */
    problems: AffectTraitProblem[];
}
/**
 * A character's affect on `asOf`, from compiled records.
 *
 * With `affect.dynamics` unset it is the latest approved stretch's declared
 * affect, or nothing when that stretch declares none. With dynamics on it
 * starts from the latest approved stretch that declares affect and replays
 * the events since. With no such stretch there is no state: replaying from a
 * baseline alone would give the character a state nobody declared.
 */
export declare function computeAffectState(projectRoot: string, config: Config, registry: Registry, engine: LinterEngine, records: any[], subject: string, asOf: string): AffectStateResult;
/**
 * `affect-discontinuity`: where the author's declarations disagree with the
 * replay. A chapter's first step is checked against the state it is entered
 * in, and each stretch against the state replayed from the stretch before it.
 * The stretch still re-anchors either way; the finding only asks whether the
 * jump was meant.
 */
export declare function discontinuityFindings(projectRoot: string, config: Config, registry: Registry, engine: LinterEngine, records: any[]): {
    file: string;
    message: string;
}[];
