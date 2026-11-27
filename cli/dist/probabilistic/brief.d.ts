/**
 * Scene-Mode 3-Move Character Brief bundle builder and pre-sampling
 * hard constraint mask (`doNotReveal` / clue-timing filter).
 *
 * Firewall rule enforced in code: every character receives ONLY their own
 * `buildContext(..., { fullState: false })` plus the immediate scene setup.
 * Never `--full-state`, never `interiority/`, never other characters' private
 * state, never future chapters.
 */
import type { Config } from '../config.js';
import type { Registry } from '../registry/entities.js';
import type { LinterEngine } from '../linter/engine.js';
import { type ContextBundle } from '../context/bundle.js';
import type { CharacterBrief, CharacterMove, MoveId, MoveMaskResult, SecretConstraintRule } from './schemas.js';
export interface SceneBriefRequest {
    story: string;
    book: string;
    chapter: number | string;
    asOf: string;
    characters: string[];
    sceneSetup: string;
}
export interface CharacterBriefPromptBundle {
    character: {
        id: string;
        displayName: string;
    };
    asOf: string;
    book: string;
    chapter: number | string;
    /** Strictly Scene-Mode (`fullState: false`), looking backward only. */
    context: ContextBundle;
    contextMarkdown: string;
    sceneSetup: string;
    /** The 3-move JSON contract instructions for the character model. */
    briefContract: string;
}
export interface BuildSceneBriefsResult {
    bundles: CharacterBriefPromptBundle[];
    errors: string[];
}
export declare const THREE_MOVE_BRIEF_CONTRACT: string;
export declare function buildSceneBriefBundles(root: string, config: Config, registry: Registry, engine: LinterEngine, records: any[], req: SceneBriefRequest): BuildSceneBriefsResult;
export declare function renderCharacterBriefPrompt(bundle: CharacterBriefPromptBundle): string;
/**
 * Whether a `doNotReveal` / `heldSecret` rule is still active (held) at
 * `(book, chapter, asOf)`. Fails closed: if `holdUntil` is omitted, the rule
 * is always active.
 */
export declare function isConstraintActive(rule: SecretConstraintRule, target: {
    book: string;
    chapter: number | string;
    asOf: string;
}): boolean;
/**
 * Evaluates active `doNotReveal` / `heldSecrets` rules deterministically
 * against each move in a 3-Move Character Brief before sampling.
 */
export declare function evaluateDeterministicMask(brief: CharacterBrief, rules: SecretConstraintRule[]): Record<MoveId, MoveMaskResult>;
/** Combines `heldSecrets` and `doNotReveal` from `config.probabilistic` with any caller overrides. */
export declare function collectConstraintRules(config: Config, extra?: SecretConstraintRule[]): SecretConstraintRule[];
export declare function findMove(brief: CharacterBrief, id: MoveId): CharacterMove;
