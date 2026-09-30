export interface VadVector {
    valence: number;
    arousal: number;
    dominance: number;
}
export interface ScaledVad {
    valence: number;
    arousal: number;
    dominance: number;
}
export type BuiltinBasin = 'hyper-vigilant' | 'depressive-exhaustion' | 'manic-fixation' | 'dissociative-numb' | 'grounded-stoic';
export declare const BUILTIN_BASINS: readonly BuiltinBasin[];
/** Scales a continuous VadVector to the integer form records carry. */
export declare function scaleVad(v: VadVector): ScaledVad;
/**
 * The labels every universe starts with. A universe adds to or overrides these
 * under `affect.labels` in `pinakes.yaml`; the numbers for its own words are
 * the author's, not Pinakes'.
 */
export declare const CORE_AFFECT_LABELS: Readonly<Record<string, VadVector>>;
/** Case- and whitespace-insensitive; nothing looser. */
export declare function normalizeAffectLabel(label: string): string;
/** A universe's `affect.labels` entry: integers in [-100, 100]. */
export interface AffectLabelConfig {
    v: number;
    a: number;
    d: number;
    aliases?: string[];
}
/**
 * The resolved vocabulary: the core labels, overlaid with the universe's, each
 * reachable by its name and its aliases. Collisions are rejected when the
 * config is loaded, so a lookup here has exactly one answer.
 */
export declare function buildAffectVocabulary(labels?: Record<string, AffectLabelConfig>): Map<string, VadVector>;
/**
 * Exact match on the normalized label, or undefined. There is no substring
 * fallback: the old one resolved `not warm` to `warm`, and an unknown label to
 * a neutral 0/0/0 that looked like data.
 */
export declare function resolveAffectLabel(label: string, vocab: Map<string, VadVector>): VadVector | undefined;
export interface AffectProblem {
    rule: 'affect-malformed' | 'affect-out-of-range';
    message: string;
}
/** What an `affect:` value says, before its labels are resolved. */
export type AffectDeclaration = {
    steps: string[];
} | {
    numeric: VadVector;
} | {
    problem: AffectProblem;
};
/**
 * Reads one `affect:` value: a label, a transition (`curious → angry`), or a
 * numeric triple `{ v, a, d }` of integers in [-100, 100].
 *
 * A label string is split by `parseRegister`, the same code that reads
 * `registers:`. The two used to have separate parsers, and one annotation
 * compiled to one register for the state event and to a transition into an
 * unknown state for the affect event.
 */
export declare function parseAffectDeclaration(raw: unknown): AffectDeclaration;
/** `to - from`, clipped: the shift an event records. */
export declare function affectDelta(from: VadVector, to: VadVector): VadVector;
/** Inclusive integer bounds in [-100, 100] per dimension; an absent one is unbounded. */
export interface BasinBounds {
    v?: [number, number];
    a?: [number, number];
    d?: [number, number];
}
/** A universe's `affect.basins` entry. `when` is only for a basin the universe adds. */
export interface BasinConfig {
    when?: BasinBounds;
    directives?: string[];
}
/**
 * The basin a coordinate falls in, or undefined when none claims it. The
 * built-in basins are tried first; a universe's own basins (those with `when`)
 * cover what they leave, in the order `pinakes.yaml` lists them.
 */
export declare function classifyAttractorBasin(vad: VadVector, basins?: Record<string, BasinConfig>): string | undefined;
/**
 * A basin's tendencies: the universe's own when `pinakes.yaml` gives them, so
 * they can be phrased in its voice guide's terms, else the built-in set.
 */
export declare function getBehavioralDirectives(basin: string, basins?: Record<string, BasinConfig>): string[];
/**
 * The block `pinakes context` prints. Advisory by construction: the voice
 * guide and the register decide how a character speaks, and these are
 * tendencies the declared affect suggests, not constraints.
 */
export declare function formatAffectPromptInjection(snapshot: {
    coordinates: ScaledVad;
    attractorBasin: string;
    behavioralDirectives?: string[];
    /** How the state was reached (anchor, events, decay), printed so the author can audit it. */
    trace?: string[];
}): string;
/** Euclidean distance between two states, in the scaled units records use. */
export declare function affectDistance(a: VadVector, b: VadVector): number;
/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export declare function daysBetween(from: string, to: string): number;
/**
 * How a character's state moves between events. Without a baseline nothing
 * decays: the state holds until the next event, and says so, rather than
 * relaxing toward a resting point nobody declared.
 */
export interface ReplayRates {
    baseline?: VadVector;
    halfLifeDays?: number;
}
/** Exponential relaxation toward the baseline over `days`. */
export declare function decayAffect(x: VadVector, days: number, rates: ReplayRates): VadVector;
/**
 * One chapter's affect for one character. `to` is set for a label transition,
 * which is an endpoint: the character ends the chapter there, whatever they
 * entered with. A numeric declaration has only `delta`, a shift.
 */
export interface ReplayEvent {
    id: string;
    /** The chapter's last date: a character's state after it is known only once it has ended. */
    end: string;
    from?: VadVector;
    to?: VadVector;
    delta: VadVector;
}
export interface ReplayStep {
    event: ReplayEvent;
    /** The state just before the event, decayed to its end date. */
    entering: VadVector;
    after: VadVector;
}
/**
 * Replays events forward from a declared state on `startDate` to `until`.
 *
 * Only events ending after `startDate` count: a stretch is written looking
 * back over its own date, so an event ending that day is already in it. Only
 * events ending on or before `until` count: one still running has not
 * happened yet. Events are applied in the order given (end date, then book,
 * then chapter), and floats are rounded only by whoever serializes the result.
 */
export declare function replayAffect(start: VadVector, startDate: string, events: ReplayEvent[], until: string, rates: ReplayRates): {
    vad: VadVector;
    steps: ReplayStep[];
};
