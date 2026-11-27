import { type Config } from './config.js';
import { MemoryFS, nodeFS, type UniverseFS } from './fs.js';
import { Registry, type RegistryConflict, type RegistryInvalidEntry } from './registry/entities.js';
import { LinterEngine, type Diagnostic, type ChapterData } from './linter/engine.js';
import { type CompilationReport, type CompilationResult } from './compiler/atproto.js';
import { type ContextBundle, type CodexSection } from './context/bundle.js';
import { type ProseReport } from './prose/check.js';
import { type AffectState, type AffectTraitProblem } from './compiler/affect-dynamics.js';
export { MemoryFS, nodeFS, type UniverseFS };
export type { Config, Diagnostic, ChapterData, CompilationReport, CompilationResult, ContextBundle, CodexSection, ProseReport, AffectState, AffectTraitProblem, RegistryConflict, RegistryInvalidEntry, };
export { BUILTIN_BASINS, CORE_AFFECT_LABELS, buildAffectVocabulary, classifyAttractorBasin, formatAffectPromptInjection, getBehavioralDirectives, normalizeAffectLabel, parseAffectDeclaration, resolveAffectLabel, type AffectDeclaration, type AffectLabelConfig, type BasinBounds, type BasinConfig, type BuiltinBasin, type ScaledVad, type VadVector, } from './compiler/affect.js';
/**
 * A loaded universe. Open one when making several calls against the same
 * root, so the config and registry are read once; every function also
 * accepts a root path and opens it itself.
 */
export interface Universe {
    /** Absolute path to the universe root. */
    root: string;
    config: Config;
    registry: Registry;
    engine: LinterEngine;
}
type UniverseInput = string | Universe;
/** Reads `pinakes.yaml` and the registry. Throws if the config is missing or invalid. */
export declare function openUniverse(root: string, ufs?: UniverseFS): Universe;
/**
 * Opens a universe entirely in memory from a `{ relativePath: fileContent }`
 * snapshot (for example, a GitHub repo snapshot cached in Cloudflare R2).
 */
export declare function openMemoryUniverse(files: Record<string, string>, root?: string): Universe;
export interface LintResult {
    diagnostics: Diagnostic[];
    /** `false` when any diagnostic is an error: the verdict `pinakes lint` exits 1 on. */
    ok: boolean;
}
/** Runs every continuity check `pinakes lint` runs. Never writes or deletes anything. */
export declare function lint(input: UniverseInput): LintResult;
export interface CompileOptions {
    /**
     * Write records and Lexicon documents to `paths.output`, and remove stale
     * files there. Defaults to `false`, unlike the CLI: a library caller asking
     * for records should not find its output directory pruned as a side effect.
     */
    write?: boolean;
}
export interface CompileResult extends CompilationReport {
    /** `false` when any record failed resolution, Lexicon validation or id checks. */
    ok: boolean;
}
/**
 * Builds and validates every record. `records` holds them all in memory;
 * `stretchFindings` and `affectFindings` are continuity findings, reported by
 * `lint` rather than counted against `ok`.
 */
export declare function compile(input: UniverseInput, options?: CompileOptions): CompileResult;
export interface ContextOptions {
    /** Include state-event annotations, which are authored omnisciently. */
    fullState?: boolean;
    /** Optional story directory name or book key to disambiguate book-scoped guest character stubs. */
    story?: string;
}
export interface ContextResult {
    /** Absent when `errors` is non-empty. */
    bundle?: ContextBundle;
    errors: string[];
}
/**
 * What `character` (a registry name or id) can see on `asOf` (YYYY-MM-DD).
 * An unresolvable character or a malformed date is returned in `errors`, not
 * thrown. Never writes anything.
 */
export declare function context(input: UniverseInput, character: string, asOf: string, options?: ContextOptions): ContextResult;
/** Renders a context bundle as the Markdown `pinakes context` prints. */
export declare const renderContextMarkdown: (bundle: ContextBundle) => string;
export interface ProseCheckOptions {
    /** Limit to story directories whose name contains this (case-insensitive). */
    story?: string;
    report?: ProseReport | 'all';
}
/**
 * The `prose-check` reports as Markdown, keyed by name. There is no verdict:
 * these are inputs to a judgment pass. Throws when there is nothing to check,
 * so a mistyped `story` cannot come back as an empty, clean-looking report.
 */
export declare function proseCheck(input: UniverseInput, options?: ProseCheckOptions): Partial<Record<ProseReport, string>>;
export interface AffectStateAtResult {
    /** Absent when the character has no declared affect to start from, or `errors` is non-empty. */
    state?: AffectState;
    /** An unresolvable character, a malformed date, or invalid codex affect fields. */
    errors: string[];
}
/**
 * A character's affect on `asOf` (YYYY-MM-DD): the state `pinakes context`
 * prints, with how it was reached. With `affect.dynamics` unset it is the
 * latest approved stretch's declared affect; with it set, that affect
 * replayed through the chapter events since. Never writes anything.
 */
export declare function affectStateAt(input: UniverseInput, character: string, asOf: string): AffectStateAtResult;
import { filterLedgerBeforeChapter, renderFirstAppearancesMarkdown, type EntityAppearancePoint, type EntityFirstAppearance } from './compiler/first-appearances.js';
import { CharacterBriefSchema, CharacterMoveSchema, MoveIdSchema, type CharacterBrief, type CharacterMove, type HoldUntil, type MoveId, type MoveMaskResult, type NarratorHandoffBundle, type ObservableCharacterMove, type PovCharacterMove, type SampleRollLog, type SecretConstraintRule } from './probabilistic/schemas.js';
import { THREE_MOVE_BRIEF_CONTRACT, collectConstraintRules, evaluateDeterministicMask, isConstraintActive, renderCharacterBriefPrompt, type BuildSceneBriefsResult, type CharacterBriefPromptBundle, type SceneBriefRequest } from './probabilistic/brief.js';
import { MOVE_IDS, computeSeed, sampleCharacterMove, type SampleOptions, type SampleOutcome, type SeedResult } from './probabilistic/sampler.js';
import { DEFAULT_NARRATOR_GUIDANCE, composeNarratorBundle, renderNarratorBundleMarkdown, stripToObservableSurface, type ComposeNarratorOptions, type WinningCharacterMove } from './probabilistic/compose.js';
import { CloudflareClefScorer, GenericLlmScorer, MockDecisionScorer, createDecisionScorer, parseClefResponse, scoreBriefWithScorer, type BriefScoreResult, type ClefScorerOptions, type DecisionQuestion, type DecisionScoreRequest, type DecisionScorer, type GenericLlmScorerOptions, type QuestionType, type ScoredAnswer } from './probabilistic/scorer.js';
import { CalibrationExampleSchema, loadCalibrationJsonl, parseCalibrationJsonl, renderCalibrationMarkdown, runCalibration, type CalibrationBucket, type CalibrationExample, type CalibrationReport, type ScorerCalibrationMetrics } from './probabilistic/calibrate.js';
import { TEMPORAL_LENSES, numberLines, renderReviewSliceMarkdown, type BuildReviewSlicesOptions, type BuildReviewSlicesResult, type ReviewSlice, type SliceDocument, type TemporalLens } from './review/slices.js';
import { ReviewFindingSchema, defaultCategoryForLens, mergeReviewFindings, parseLineSpan, renderMergedFindingsMarkdown, type ConvergenceCluster, type FindingCategory, type FindingSeverity, type MergedReviewFinding, type MergedReviewReport, type ReviewFinding, type ReviewLens } from './review/findings.js';
import { collectAmbiguousTellHits, runProbabilisticLintPrepass, type EscalatedItem, type LensReviewer, type PlantedClue, type ProbabilisticPrepassOptions, type ProbabilisticPrepassResult } from './review/runner.js';
export { filterLedgerBeforeChapter, renderFirstAppearancesMarkdown, MoveIdSchema, CharacterMoveSchema, CharacterBriefSchema, THREE_MOVE_BRIEF_CONTRACT, collectConstraintRules, evaluateDeterministicMask, isConstraintActive, renderCharacterBriefPrompt, MOVE_IDS, computeSeed, sampleCharacterMove, DEFAULT_NARRATOR_GUIDANCE, composeNarratorBundle, stripToObservableSurface, renderNarratorBundleMarkdown, CloudflareClefScorer, MockDecisionScorer, GenericLlmScorer, createDecisionScorer, parseClefResponse, scoreBriefWithScorer, CalibrationExampleSchema, loadCalibrationJsonl, parseCalibrationJsonl, runCalibration, renderCalibrationMarkdown, TEMPORAL_LENSES, numberLines, renderReviewSliceMarkdown, ReviewFindingSchema, defaultCategoryForLens, parseLineSpan, mergeReviewFindings, renderMergedFindingsMarkdown, collectAmbiguousTellHits, runProbabilisticLintPrepass, };
export type { EntityAppearancePoint, EntityFirstAppearance, MoveId, CharacterMove, CharacterBrief, HoldUntil, SecretConstraintRule, MoveMaskResult, SampleRollLog, ObservableCharacterMove, PovCharacterMove, NarratorHandoffBundle, SceneBriefRequest, CharacterBriefPromptBundle, BuildSceneBriefsResult, SeedResult, SampleOptions, SampleOutcome, WinningCharacterMove, ComposeNarratorOptions, QuestionType, DecisionQuestion, ScoredAnswer, DecisionScoreRequest, DecisionScorer, ClefScorerOptions, GenericLlmScorerOptions, BriefScoreResult, CalibrationExample, CalibrationBucket, ScorerCalibrationMetrics, CalibrationReport, TemporalLens, SliceDocument, ReviewSlice, BuildReviewSlicesOptions, BuildReviewSlicesResult, ReviewLens, FindingSeverity, FindingCategory, ReviewFinding, MergedReviewFinding, ConvergenceCluster, MergedReviewReport, PlantedClue, ProbabilisticPrepassOptions, EscalatedItem, ProbabilisticPrepassResult, LensReviewer, };
/** Builds the deterministic First-Appearance Entity Ledger for a universe. Never writes to disk. */
export declare function firstAppearances(input: UniverseInput): EntityFirstAppearance[];
/** Assembles Scene-Mode 3-Move Character Brief prompt bundles with the information firewall enforced. */
export declare function briefBundles(input: UniverseInput, request: Omit<SceneBriefRequest, 'book'> & {
    book?: string;
}): BuildSceneBriefsResult;
export interface SampleBriefOptions {
    /** Manual raw probabilities; if omitted, `scorer` is used. */
    rawProbs?: Record<MoveId, number>;
    scorer?: DecisionScorer;
    sceneSetup?: string;
    story?: string;
    floor?: number;
    temperature?: number;
    beatType?: string;
    reroll?: string | number;
    extraConstraints?: SecretConstraintRule[];
}
/**
 * Evaluates pre-sampling constraints (deterministic + optional semantic Clef gates),
 * scores candidate moves when a scorer is provided, and draws deterministically.
 */
export declare function sampleBrief(input: UniverseInput, brief: CharacterBrief, options?: SampleBriefOptions): Promise<SampleOutcome>;
/** Assembles a POV-locked Single Narrator Pen Handoff bundle. */
export declare function composeNarrator(input: UniverseInput, options: Omit<ComposeNarratorOptions, 'projectRoot' | 'ufs'>): {
    bundle?: NarratorHandoffBundle;
    errors: string[];
};
/** Assembles deterministic temporal review slices for the 6-lens review board. Never writes to disk. */
export declare function reviewSlices(input: UniverseInput, options: BuildReviewSlicesOptions): BuildReviewSlicesResult;
/** Runs the batched Clef-flash -> Clef 27B probabilistic lint pre-pass for a target chapter. */
export declare function reviewPrepass(input: UniverseInput, options: {
    story: string;
    chapter: number | string;
    flashScorer?: DecisionScorer;
    deepScorer?: DecisionScorer;
    plantedClues?: PlantedClue[];
}): Promise<{
    result?: ProbabilisticPrepassResult;
    errors: string[];
}>;
export { PinakesMcpServer, type McpMode, type McpToolDefinition, type McpToolCallResult, type McpExtraTool, type PinakesMcpServerOptions, type JsonRpcRequest, type JsonRpcResponse, } from './mcp/server.js';
