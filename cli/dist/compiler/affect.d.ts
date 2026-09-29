/**
 * Mathematical dynamical system for character affective state.
 *
 * Implements a two-timescale leaky-integrator with homeostatic relaxation,
 * allostatic baseline adaptation, reward prediction error (RPE) modulation,
 * and phase-space attractor basin classification.
 *
 * Mathematical Foundations:
 * -------------------------
 * 1. Bounded Continuous PAD/VAD State Space:
 *    At any story time \tau_t, a character's state consists of:
 *      - Fast immediate affect vector: x_t = [v_t, a_t, d_t]^T \in [-1.0, 1.0]^3
 *      - Slow homeostatic attractor:   \mu_t = [\mu_{v,t}, \mu_{a,t}, \mu_{d,t}]^T \in [-1.0, 1.0]^3
 *    Where:
 *      - v (Valence):   Pleasure / positive valence vs. pain / dysphoria
 *      - a (Arousal):   Autonomic activation / adrenaline vs. lethargy / hypo-arousal
 *      - d (Dominance): Agency / perceived control vs. helplessness / submissiveness
 *
 *    Note on AT Protocol Lexicon serialization:
 *    AT Protocol Lexicons enforce determinism using 32-bit signed integers.
 *    Coordinates and deltas are stored as basis-point percentages scaled to [-100, 100],
 *    and RPE is scaled to [-200, 200].
 *
 * 2. Continuous Homeostatic Relaxation (Fast Timescale):
 *    Between narrative shocks, immediate affect exponentially relaxes toward baseline:
 *      x_{t + \Delta\tau} = \mu_t + (x_t - \mu_t) \cdot e^{-\lambda \Delta\tau}
 *    Where \Delta\tau is elapsed narrative time in days, and \lambda is the decay rate.
 *
 * 3. Allostatic Adaptation (Slow Timescale):
 *    Chronic exposure to high-stress or depressed states shifts the baseline:
 *      \mu_{t+1} = \operatorname{clip}(\mu_t + \alpha (x_t - \mu_t) \Delta\tau, -1.0, 1.0)
 *    Where \alpha \ll \lambda is the allostatic drag coefficient.
 *
 * 4. Episodic Shocks & Reward Prediction Error (RPE):
 *    A narrative stimulus induces an instantaneous impulse \Delta x and an RPE \delta_{rpe} \in [-2.0, 2.0]:
 *      \delta_{rpe} = R_{actual} - R_{expected}
 *    Modulation:
 *      \Delta x_{modulated} = \Delta x + [ \beta_v \cdot \delta_{rpe}, \beta_a \cdot |\delta_{rpe}|, \beta_d \cdot \delta_{rpe} ]^T
 *      x_{t}^{post} = \operatorname{clip}(x_t + \Delta x_{modulated}, -1.0, 1.0)
 *
 * 5. Attractor Basins:
 *    Non-linear qualitative behavioral modes partitioned over VAD phase space:
 *      - hyper-vigilant:        a > 0.35 \land v < -0.15
 *      - depressive-exhaustion: a < -0.25 \land v < -0.25 \land d < -0.15
 *      - manic-fixation:        a > 0.45 \land d > 0.25 \land |v| > 0.20
 *      - dissociative-numb:     a < -0.45 \land |v| \le 0.25 \land d < -0.20
 *      - grounded-stoic:        default resting / deliberate agency
 */
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
export interface ScaledAffectCoordinates extends ScaledVad {
    baselineValence: number;
}
export type AttractorBasin = 'hyper-vigilant' | 'depressive-exhaustion' | 'manic-fixation' | 'grounded-stoic' | 'dissociative-numb';
export interface AffectSimulationParams {
    /** Fast relaxation rate toward baseline (\lambda). Default = 0.15 (~4.6-day half-life). */
    relaxationRate: number;
    /** Slow allostatic baseline drag coefficient (\alpha). Default = 0.03. */
    allostaticRate: number;
    /** RPE modulation coefficients [\beta_v, \beta_a, \beta_d]. */
    rpeSensitivity: {
        valence: number;
        arousal: number;
        dominance: number;
    };
}
export declare const DEFAULT_AFFECT_PARAMS: AffectSimulationParams;
/** Clamps a number to [min, max]. */
export declare function clip(val: number, min?: number, max?: number): number;
/** Scales continuous [-1.0, 1.0] float to [-100, 100] integer. */
export declare function toScaledInt(val: number, min?: number, max?: number): number;
/** Converts integer scaled value [-100, 100] back to continuous [-1.0, 1.0] float. */
export declare function fromScaledInt(val: number): number;
/** Scales a continuous VadVector to integer ScaledVad. */
export declare function scaleVad(v: VadVector): ScaledVad;
/** Unscales an integer ScaledVad to continuous VadVector. */
export declare function unscaleVad(s: ScaledVad): VadVector;
/** Computes the continuous exponential relaxation of affect toward baseline across \Delta\tau days. */
export declare function relaxAffect(current: VadVector, baseline: VadVector, deltaDays: number, lambda?: number): VadVector;
/** Computes slow allostatic baseline adaptation under sustained affect. */
export declare function adaptBaseline(current: VadVector, baseline: VadVector, deltaDays: number, alpha?: number): VadVector;
/**
 * Applies an episodic stimulus impulse and RPE shock to an immediate affect vector.
 */
export declare function applyEpisodicShock(current: VadVector, impulse: VadVector, rpe?: number, params?: AffectSimulationParams): VadVector;
/**
 * Classifies an affect vector into one of 5 canonical attractor basins.
 */
export declare function classifyAttractorBasin(vad: VadVector): AttractorBasin;
/**
 * Generates prompt-injection behavioral constraints tailored to an attractor basin.
 */
export declare function getBehavioralDirectives(basin: AttractorBasin): string[];
/**
 * Standard register vocabulary mappings to canonical VAD coordinates.
 * Allows authors to write qualitative register tags while Pinakes compiles
 * deterministic mathematical coordinates.
 */
export declare const STANDARD_REGISTER_VAD: Record<string, VadVector>;
/**
 * Resolves a register string or qualitative label to a base VadVector.
 * Falls back to neutral resting state if unknown.
 */
export declare function resolveRegisterVad(registerName: string): VadVector;
/**
 * Calculates the delta between two register names or steps.
 */
export declare function calculateRegisterDelta(fromRegister: string, toRegister: string): VadVector;
/**
 * Formats an LLM system prompt injection block from an affect snapshot.
 */
export declare function formatAffectPromptInjection(snapshot: {
    coordinates: ScaledAffectCoordinates;
    attractorBasin: string;
    openTensions?: string[];
    behavioralDirectives?: string[];
}): string;
export interface AffectTransition {
    fromRegister: string;
    toRegister: string;
    note?: string;
}
/**
 * Extracts the starting and ending qualitative registers from an author's register string,
 * handling transitions inside or outside parentheticals (e.g. "private (curious -> quietly alarmed)"
 * or "public -> private (hostess softening)").
 */
export declare function parseAffectTransition(val: string): AffectTransition;
