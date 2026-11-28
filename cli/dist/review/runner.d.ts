/**
 * Six-Lens Review Board runner + Clef-flash / Clef 27B Probabilistic Lint Pre-Pass.
 *
 * Runs a single batched multi-question pass (up to 64 typed binary/enum/scale
 * questions) over a chapter + structured Pinakes slice:
 * - Held-secret leak probability per configured held secret
 * - POV slip detection (yes/no)
 * - Tone scale (1–10) ceiling check
 * - Clue telegraphing per planted clue (`invisible | fair-play | over-signaled`)
 * - Ambiguous mechanical-tell triage (regex hits from `prose/check` like
 *   `negative-parallelism-split` or `corporate-filler`, plus configurable
 *   `craftVocabulary` words like `red herring(s)`) into `natural-dialogue` vs
 *   `ai-fingerprint`.
 *
 * Escalation: `clef-flash` -> mid-confidence (`[low, high]`, default `0.35-0.65`)
 * or flagged items escalate to `clef` 27B -> still-flagged items escalate to
 * full-prose LLM lens reviewers.
 */
import type { Config } from '../config.js';
import type { DecisionQuestion, DecisionScorer, ScoredAnswer } from '../probabilistic/scorer.js';
import type { ReviewSlice } from './slices.js';
import { type MergedReviewReport, type ReviewFinding } from './findings.js';
import { type WitnessCheckInput } from './witness.js';
export interface PlantedClue {
    id: string;
    description: string;
    lineRef?: string;
}
export interface ProbabilisticPrepassOptions {
    /** Fast tier scorer (e.g. `clef-flash`). */
    flashScorer: DecisionScorer;
    /** Escalation tier scorer (e.g. `clef` 27B). Optional; if omitted, no tier-2 escalation runs. */
    deepScorer?: DecisionScorer;
    /** Optional clues planted in this chapter to check for telegraphing. */
    plantedClues?: PlantedClue[];
    /** Optional witness / off-page knowledge check input derived from compiled prior chapters. */
    witnessCheck?: WitnessCheckInput;
    /** Override escalation thresholds from config. */
    lowConfidence?: number;
    highConfidence?: number;
    leakThreshold?: number;
    toneCeiling?: number;
}
export interface EscalatedItem {
    questionId: string;
    reason: string;
    flashAnswer: ScoredAnswer;
    deepAnswer?: ScoredAnswer;
    escalateToLlm: boolean;
}
export interface ProbabilisticPrepassResult {
    questions: DecisionQuestion[];
    flashAnswers: ScoredAnswer[];
    deepAnswers: ScoredAnswer[];
    escalations: EscalatedItem[];
    findings: ReviewFinding[];
    merged: MergedReviewReport;
}
/** Interface for full-prose LLM lens reviewers (Claude, Gemini, local agent, CI). */
export interface LensReviewer {
    readonly name: string;
    reviewSlice(slice: ReviewSlice): Promise<ReviewFinding[]>;
}
interface TellHit {
    label: string;
    lineNum: number;
    snippet: string;
}
/**
 * Extracts ambiguous mechanical hits from `prose/check` signals plus
 * configured `craftVocabulary` terms (e.g. `red herring(s)`).
 */
export declare function collectAmbiguousTellHits(chapterBody: string, config: Config): TellHit[];
export declare function runProbabilisticLintPrepass(chapterBody: string, slice: ReviewSlice, config: Config, options: ProbabilisticPrepassOptions): Promise<ProbabilisticPrepassResult>;
export {};
