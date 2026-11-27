/**
 * Pluggable DecisionScorer interface + adapters:
 * 1. `CloudflareClefScorer`: Cloudflare Workers AI (`@cf/cloudflare/clef`,
 *    `@cf/cloudflare/clef-flash`) or any Jev-API-compatible endpoint.
 * 2. `MockDecisionScorer`: deterministic local/offline scorer for tests and
 *    credential-free workflows.
 * 3. `GenericLlmScorer`: OpenAI-compatible JSON-scoring fallback.
 *
 * Also provides `scoreBriefWithScorer` to score a 3-Move Character Brief and
 * evaluate `doNotReveal` semantic constraint gates in a single batched pass.
 */
import type { Config } from '../config.js';
import type { CharacterBrief, MoveId, MoveMaskResult, SecretConstraintRule } from './schemas.js';
export type QuestionType = 'binary' | 'enum' | 'scale' | 'move-choice';
export interface DecisionQuestion {
    id: string;
    type: QuestionType;
    prompt: string;
    /** For `enum` and `move-choice`. For `binary`, defaults to `['yes', 'no']`. */
    options?: string[];
    /** For `scale`, e.g. `[1, 10]`. */
    scale?: [number, number];
}
export interface ScoredAnswer {
    id: string;
    /** Calibrated probability distribution over options (sums to ~1). */
    probabilities: Record<string, number>;
    /** Expected numeric value for `scale` questions. */
    expectedValue?: number;
    /** Highest-probability option label. */
    topLabel?: string;
    /** Probability of `topLabel`. */
    topProbability?: number;
    raw?: unknown;
}
export interface DecisionScoreRequest {
    context: string;
    questions: DecisionQuestion[];
    model?: string;
}
export interface DecisionScorer {
    readonly name: string;
    score(request: DecisionScoreRequest): Promise<ScoredAnswer[]>;
}
export interface ClefScorerOptions {
    model?: string;
    /** Custom Jev-API / Workers AI compatible URL. Overrides `accountId` URL when set. */
    endpoint?: string;
    accountId?: string;
    apiToken?: string;
    fetchImpl?: typeof fetch;
}
/**
 * Parses a Clef / Workers AI / Jev-API response into `ScoredAnswer[]`.
 * Accepts:
 * - `{ result: { answers: [...] } }` (Workers AI envelope)
 * - `{ answers: [...] }` (direct Jev-API)
 * - `{ result: [...] }` or raw array `[...]`
 */
export declare function parseClefResponse(payload: any, questions: DecisionQuestion[]): ScoredAnswer[];
/**
 * First-class Cloudflare Clef / Jev-API decision-model adapter.
 * Supports `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash`, or any
 * Jev-API-compatible self-hosted endpoint.
 */
export declare class CloudflareClefScorer implements DecisionScorer {
    readonly name: string;
    private readonly model;
    private readonly endpoint?;
    private readonly accountId?;
    private readonly apiToken?;
    private readonly fetchImpl;
    constructor(options?: ClefScorerOptions);
    score(request: DecisionScoreRequest): Promise<ScoredAnswer[]>;
}
/**
 * Deterministic local/offline scorer for tests and credential-free runs.
 * Returns fixture probabilities if supplied for a question id, otherwise a
 * clean deterministic distribution.
 */
export declare class MockDecisionScorer implements DecisionScorer {
    readonly name: string;
    private readonly fixtures;
    constructor(fixtures?: Record<string, Record<string, number>>, name?: string);
    score(request: DecisionScoreRequest): Promise<ScoredAnswer[]>;
}
export interface GenericLlmScorerOptions {
    endpoint: string;
    model: string;
    apiKey?: string;
    fetchImpl?: typeof fetch;
}
/**
 * Generic OpenAI-compatible chat-completions JSON fallback scorer for local
 * workflows without Workers AI credentials.
 */
export declare class GenericLlmScorer implements DecisionScorer {
    readonly name: string;
    private readonly endpoint;
    private readonly model;
    private readonly apiKey?;
    private readonly fetchImpl;
    constructor(options: GenericLlmScorerOptions);
    score(request: DecisionScoreRequest): Promise<ScoredAnswer[]>;
}
export declare function createDecisionScorer(config: Config, override?: {
    provider?: 'clef' | 'clef-flash' | 'llm' | 'mock';
    model?: string;
    fetchImpl?: typeof fetch;
    mockFixtures?: Record<string, Record<string, number>>;
}): DecisionScorer;
export interface BriefScoreResult {
    rawProbs: Record<MoveId, number>;
    semanticMask: Partial<Record<MoveId, MoveMaskResult>>;
    answers: ScoredAnswer[];
}
/**
 * Scores a 3-Move Character Brief (returning `[pA, pB, pC]`) and evaluates
 * `doNotReveal` binary semantic constraint gates in a single batched pass.
 */
export declare function scoreBriefWithScorer(scorer: DecisionScorer, brief: CharacterBrief, params: {
    contextMarkdown: string;
    sceneSetup: string;
    constraints?: SecretConstraintRule[];
    leakThreshold?: number;
}): Promise<BriefScoreResult>;
