import type { CharacterBrief, MoveId, MoveMaskResult, SampleRollLog } from './schemas.js';
export declare const MOVE_IDS: readonly MoveId[];
export interface SeedResult {
    seedInput: string;
    seedHash: string;
    /** Uniform float in [0, 1) derived from the first 53 bits of SHA-256. */
    u: number;
}
/**
 * Computes the deterministic seed hash and uniform draw `u ∈ [0, 1)`.
 */
export declare function computeSeed(params: {
    book: string;
    chapter: number | string;
    asOf: string;
    character: string;
    reroll?: string | number;
}): SeedResult;
export interface SampleOptions {
    /** Raw probabilities for A, B, C (non-negative; normalized internally). */
    rawProbs: Record<MoveId, number>;
    /** Optional pre-sampling hard mask per move. */
    mask?: Partial<Record<MoveId, MoveMaskResult>>;
    /** Plausibility floor (default 0.08). Moves below floor are dropped unless all surviving moves fall below. */
    floor?: number;
    /** Temperature scaling (default 0.85). Lower = sharper, higher = flatter. */
    temperature?: number;
    /** Optional reroll token appended to the seed string. */
    reroll?: string | number;
    /** Scorer label recorded in the roll log. */
    scorer?: string;
}
export interface SampleOutcome {
    ok: boolean;
    error?: string;
    log?: SampleRollLog;
}
export declare function sampleCharacterMove(brief: CharacterBrief, options: SampleOptions): SampleOutcome;
