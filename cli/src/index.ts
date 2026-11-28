/**
 * The programmatic API: what `lint`, `compile`, `context` and `prose-check`
 * do, as functions that return their findings instead of printing them and
 * exiting. The CLI is built on these, so the two cannot disagree about a
 * verdict.
 *
 * Everything exported here is a compatibility promise. Internals stay
 * unexported so they can change without a major version.
 */
import path from 'path';
import { loadConfig, type Config } from './config.js';
import { MemoryFS, nodeFS, type UniverseFS } from './fs.js';
import { Registry, type RegistryConflict, type RegistryInvalidEntry } from './registry/entities.js';
import { LinterEngine, type Diagnostic, type ChapterData } from './linter/engine.js';
import { YamlRulesLoader } from './linter/yaml-loader.js';
import { compileProject, type CompilationReport, type CompilationResult } from './compiler/atproto.js';
import { buildContext, renderMarkdown, type ContextBundle, type CodexSection } from './context/bundle.js';
import { buildProseReports, type ProseReport } from './prose/check.js';
import { computeAffectState, type AffectState, type AffectTraitProblem } from './compiler/affect-dynamics.js';
import { isCalendarDate } from './linter/stretches.js';

export { MemoryFS, nodeFS, type UniverseFS };

export type {
  Config,
  Diagnostic,
  ChapterData,
  CompilationReport,
  CompilationResult,
  ContextBundle,
  CodexSection,
  ProseReport,
  AffectState,
  AffectTraitProblem,
  RegistryConflict,
  RegistryInvalidEntry,
};

// The Keystatic collections are not exported here: they are
// `@bbthorson/pinakes/keystatic`. Keystatic bundles its config into the
// browser, and this entry point carries the Node-side compiler.

// Named, not `export *`: everything listed is a compatibility promise, and the
// affect module's internals should stay free to change.
export {
  BUILTIN_BASINS,
  CORE_AFFECT_LABELS,
  buildAffectVocabulary,
  classifyAttractorBasin,
  formatAffectPromptInjection,
  getBehavioralDirectives,
  normalizeAffectLabel,
  parseAffectDeclaration,
  resolveAffectLabel,
  type AffectDeclaration,
  type AffectLabelConfig,
  type BasinBounds,
  type BasinConfig,
  type BuiltinBasin,
  type ScaledVad,
  type VadVector,
} from './compiler/affect.js';

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
export function openUniverse(root: string, ufs: UniverseFS = nodeFS): Universe {
  const abs = path.resolve(root);
  const { config } = loadConfig(abs, ufs);
  const registry = new Registry(abs, config.paths.registry, config.paths.nonEntities, ufs);
  return { root: abs, config, registry, engine: new LinterEngine(abs, config, registry, ufs) };
}

/**
 * Opens a universe entirely in memory from a `{ relativePath: fileContent }`
 * snapshot (for example, a GitHub repo snapshot cached in Cloudflare R2).
 */
export function openMemoryUniverse(files: Record<string, string>, root = '/universe'): Universe {
  const mem = new MemoryFS(files, root);
  return openUniverse(mem.root, mem);
}

function open(input: UniverseInput): Universe {
  return typeof input === 'string' ? openUniverse(input) : input;
}

export interface LintResult {
  diagnostics: Diagnostic[];
  /** `false` when any diagnostic is an error: the verdict `pinakes lint` exits 1 on. */
  ok: boolean;
}

/** Runs every continuity check `pinakes lint` runs. Never writes or deletes anything. */
export function lint(input: UniverseInput): LintResult {
  const u = open(input);
  const diagnostics = u.engine.lint();

  // Stretch rules need every compiled record's dates, so build the record
  // set in memory (nothing is written) and take its stretch and affect findings.
  const { stretchFindings, affectFindings } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  diagnostics.push(...stretchFindings, ...affectFindings);

  if (u.config.paths.rules) {
    const customRules = new YamlRulesLoader(u.root, u.config.paths.rules);
    for (const storyDir of u.engine.getStories()) {
      diagnostics.push(...customRules.runCustomRules(u.engine.loadChapters(storyDir)));
    }
  }

  return { diagnostics, ok: !diagnostics.some((d) => d.severity === 'error') };
}

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
export function compile(input: UniverseInput, options: CompileOptions = {}): CompileResult {
  const u = open(input);
  const report = compileProject(u.root, u.config, u.registry, u.engine, { write: options.write ?? false });
  return { ...report, ok: report.diagnostics.length === 0 };
}

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
export function context(
  input: UniverseInput,
  character: string,
  asOf: string,
  options: ContextOptions = {}
): ContextResult {
  const u = open(input);
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  return buildContext(u.root, u.config, u.registry, u.engine, records, character, asOf, {
    fullState: Boolean(options.fullState),
    story: options.story,
  });
}

/** Renders a context bundle as the Markdown `pinakes context` prints. */
export const renderContextMarkdown: (bundle: ContextBundle) => string = renderMarkdown;

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
export function proseCheck(input: UniverseInput, options: ProseCheckOptions = {}): Partial<Record<ProseReport, string>> {
  const u = open(input);
  const report = options.report ?? 'all';
  if (!['tells', 'closers', 'all'].includes(report)) {
    throw new Error(`Unknown report '${report}'. Expected tells, closers or all.`);
  }

  let stories = u.engine.getStories();
  if (options.story) {
    const needle = options.story.toLowerCase();
    stories = stories.filter((s) => path.basename(s).toLowerCase().includes(needle));
  }
  if (stories.length === 0) throw new Error('No stories found.');

  const chapters = stories.flatMap((s) => u.engine.loadChapters(s));
  if (chapters.length === 0) throw new Error('No chapters found.');

  return buildProseReports(chapters, u.config, report);
}

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
export function affectStateAt(input: UniverseInput, character: string, asOf: string): AffectStateAtResult {
  const u = open(input);
  const resolved = u.registry.resolve(character, 'character');
  const errors: string[] = [];
  if (!resolved) errors.push(`'${character}' does not resolve to a registry character.`);
  if (!isCalendarDate(asOf)) errors.push(`asOf must be a YYYY-MM-DD calendar date; got '${asOf}'.`);
  if (!resolved || errors.length) return { errors };
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  const { state, problems } = computeAffectState(u.root, u.config, u.registry, u.engine, records, resolved.id, asOf);
  return { state, errors: problems.map((p) => `${p.file}: ${p.message}`) };
}

// ------------------------------------------------------------------ probabilistic & review layer

import {
  buildFirstAppearanceLedgerFromEngine,
  filterLedgerBeforeChapter,
  getBookKeyFromDir,
  renderFirstAppearancesMarkdown,
  type EntityAppearancePoint,
  type EntityFirstAppearance,
} from './compiler/first-appearances.js';
import {
  CharacterBriefSchema,
  CharacterMoveSchema,
  MoveIdSchema,
  ReasoningEffortSchema,
  type BriefRouteDecision,
  type CharacterBrief,
  type CharacterMove,
  type HoldUntil,
  type MoveId,
  type MoveMaskResult,
  type NarratorHandoffBundle,
  type ObservableCharacterMove,
  type PovCharacterMove,
  type ReasoningEffort,
  type SampleRollLog,
  type SecretConstraintRule,
} from './probabilistic/schemas.js';
import {
  THREE_MOVE_BRIEF_CONTRACT,
  buildSceneBriefBundles,
  collectConstraintRules,
  evaluateDeterministicMask,
  isConstraintActive,
  renderCharacterBriefPrompt,
  resolveBriefRoute,
  type BuildSceneBriefsResult,
  type CharacterBriefPromptBundle,
  type SceneBriefRequest,
} from './probabilistic/brief.js';
import {
  MOVE_IDS,
  computeSeed,
  sampleCharacterMove,
  type SampleOptions,
  type SampleOutcome,
  type SeedResult,
} from './probabilistic/sampler.js';
import {
  DEFAULT_NARRATOR_GUIDANCE,
  composeNarratorBundle,
  renderNarratorBundleMarkdown,
  stripToObservableSurface,
  type ComposeNarratorOptions,
  type WinningCharacterMove,
} from './probabilistic/compose.js';
import {
  CloudflareClefScorer,
  GenericLlmScorer,
  MockDecisionScorer,
  createDecisionScorer,
  parseClefResponse,
  scoreBriefWithScorer,
  type BriefScoreResult,
  type ClefScorerOptions,
  type DecisionQuestion,
  type DecisionScoreRequest,
  type DecisionScorer,
  type GenericLlmScorerOptions,
  type QuestionType,
  type ScoredAnswer,
} from './probabilistic/scorer.js';
import {
  CalibrationExampleSchema,
  loadCalibrationJsonl,
  parseCalibrationJsonl,
  renderCalibrationMarkdown,
  runCalibration,
  type CalibrationBucket,
  type CalibrationExample,
  type CalibrationReport,
  type ScorerCalibrationMetrics,
} from './probabilistic/calibrate.js';
import {
  TEMPORAL_LENSES,
  buildReviewSlices,
  numberLines,
  renderReviewSliceMarkdown,
  type BuildReviewSlicesOptions,
  type BuildReviewSlicesResult,
  type ReviewSlice,
  type SliceDocument,
  type TemporalLens,
} from './review/slices.js';
import {
  ReviewFindingSchema,
  defaultCategoryForLens,
  mergeReviewFindings,
  parseLineSpan,
  renderMergedFindingsMarkdown,
  type ConvergenceCluster,
  type FindingCategory,
  type FindingSeverity,
  type MergedReviewFinding,
  type MergedReviewReport,
  type ReviewFinding,
  type ReviewLens,
} from './review/findings.js';
import {
  collectAmbiguousTellHits,
  runProbabilisticLintPrepass,
  type EscalatedItem,
  type LensReviewer,
  type PlantedClue,
  type ProbabilisticPrepassOptions,
  type ProbabilisticPrepassResult,
} from './review/runner.js';
import {
  detectWitnessKnowledgeIssues,
  type PriorChapterWitnessInfo,
  type TargetCharacterSurface,
  type WitnessCheckInput,
} from './review/witness.js';
import {
  chapterWordToNumber,
  numberToChapterWord,
  renumberChapters,
  type RenumberFileChange,
  type RenumberOptions,
  type RenumberResult,
  type StaleChapterReference,
} from './renumber.js';

export {
  // First-appearance ledger
  filterLedgerBeforeChapter,
  renderFirstAppearancesMarkdown,
  // Probabilistic schemas & Scene-Mode brief
  MoveIdSchema,
  CharacterMoveSchema,
  CharacterBriefSchema,
  ReasoningEffortSchema,
  THREE_MOVE_BRIEF_CONTRACT,
  collectConstraintRules,
  evaluateDeterministicMask,
  isConstraintActive,
  renderCharacterBriefPrompt,
  resolveBriefRoute,
  // Seeded sampler
  MOVE_IDS,
  computeSeed,
  sampleCharacterMove,
  // POV-locked narrator handoff
  DEFAULT_NARRATOR_GUIDANCE,
  composeNarratorBundle,
  stripToObservableSurface,
  renderNarratorBundleMarkdown,
  // Decision scorers
  CloudflareClefScorer,
  MockDecisionScorer,
  GenericLlmScorer,
  createDecisionScorer,
  parseClefResponse,
  scoreBriefWithScorer,
  // Calibration
  CalibrationExampleSchema,
  loadCalibrationJsonl,
  parseCalibrationJsonl,
  runCalibration,
  renderCalibrationMarkdown,
  // Six-lens review board
  TEMPORAL_LENSES,
  numberLines,
  renderReviewSliceMarkdown,
  ReviewFindingSchema,
  defaultCategoryForLens,
  parseLineSpan,
  mergeReviewFindings,
  renderMergedFindingsMarkdown,
  collectAmbiguousTellHits,
  runProbabilisticLintPrepass,
  detectWitnessKnowledgeIssues,
  // Chapter renumber helper
  numberToChapterWord,
  chapterWordToNumber,
};

export type {
  EntityAppearancePoint,
  EntityFirstAppearance,
  MoveId,
  CharacterMove,
  CharacterBrief,
  ReasoningEffort,
  BriefRouteDecision,
  HoldUntil,
  SecretConstraintRule,
  MoveMaskResult,
  SampleRollLog,
  ObservableCharacterMove,
  PovCharacterMove,
  NarratorHandoffBundle,
  SceneBriefRequest,
  CharacterBriefPromptBundle,
  BuildSceneBriefsResult,
  SeedResult,
  SampleOptions,
  SampleOutcome,
  WinningCharacterMove,
  ComposeNarratorOptions,
  QuestionType,
  DecisionQuestion,
  ScoredAnswer,
  DecisionScoreRequest,
  DecisionScorer,
  ClefScorerOptions,
  GenericLlmScorerOptions,
  BriefScoreResult,
  CalibrationExample,
  CalibrationBucket,
  ScorerCalibrationMetrics,
  CalibrationReport,
  TemporalLens,
  SliceDocument,
  ReviewSlice,
  BuildReviewSlicesOptions,
  BuildReviewSlicesResult,
  ReviewLens,
  FindingSeverity,
  FindingCategory,
  ReviewFinding,
  MergedReviewFinding,
  ConvergenceCluster,
  MergedReviewReport,
  PlantedClue,
  ProbabilisticPrepassOptions,
  EscalatedItem,
  ProbabilisticPrepassResult,
  LensReviewer,
  PriorChapterWitnessInfo,
  TargetCharacterSurface,
  WitnessCheckInput,
  RenumberOptions,
  RenumberFileChange,
  StaleChapterReference,
  RenumberResult,
};

/** Builds the deterministic First-Appearance Entity Ledger for a universe. Never writes to disk. */
export function firstAppearances(input: UniverseInput): EntityFirstAppearance[] {
  const u = open(input);
  return buildFirstAppearanceLedgerFromEngine(u.registry, u.engine);
}

/** Assembles Scene-Mode 3-Move Character Brief prompt bundles with the information firewall enforced. */
export function briefBundles(
  input: UniverseInput,
  request: Omit<SceneBriefRequest, 'book'> & { book?: string }
): BuildSceneBriefsResult {
  const u = open(input);
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  const needle = request.story.toLowerCase();
  const matchedStory = u.engine
    .getStories()
    .find((s) => path.basename(s).toLowerCase().includes(needle) || getBookKeyFromDir(s) === needle);
  const book = request.book ?? (matchedStory ? getBookKeyFromDir(matchedStory) : request.story);
  return buildSceneBriefBundles(u.root, u.config, u.registry, u.engine, records, { ...request, book });
}

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
export async function sampleBrief(
  input: UniverseInput,
  brief: CharacterBrief,
  options: SampleBriefOptions = {}
): Promise<SampleOutcome> {
  const u = open(input);
  const validated = CharacterBriefSchema.parse(brief);
  const rules = collectConstraintRules(u.config, options.extraConstraints);
  const detMask = evaluateDeterministicMask(validated, rules);

  let rawProbs = options.rawProbs;
  let scorerName = 'manual';
  const combinedMask: Record<MoveId, MoveMaskResult> = {
    A: { ...detMask.A, reasons: [...detMask.A.reasons] },
    B: { ...detMask.B, reasons: [...detMask.B.reasons] },
    C: { ...detMask.C, reasons: [...detMask.C.reasons] },
  };

  if (!rawProbs) {
    const scorer = options.scorer ?? createDecisionScorer(u.config);
    scorerName = scorer.name;
    const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
    const ctxRes = buildContext(u.root, u.config, u.registry, u.engine, records, validated.character, validated.asOf, {
      fullState: false,
      story: options.story ?? validated.book,
    });
    const ctxMd = ctxRes.bundle ? renderMarkdown(ctxRes.bundle) : `Character: ${validated.character}`;
    const scored = await scoreBriefWithScorer(scorer, validated, {
      contextMarkdown: ctxMd,
      sceneSetup: options.sceneSetup ?? '',
      constraints: rules,
      leakThreshold: u.config.probabilistic.escalation.leakThreshold,
    });
    rawProbs = scored.rawProbs;
    for (const id of MOVE_IDS) {
      const sem = scored.semanticMask[id];
      if (sem?.masked) {
        combinedMask[id].masked = true;
        combinedMask[id].reasons.push(...sem.reasons);
      }
    }
  }

  const beatType = options.beatType ?? validated.beatType;
  const samplingCfg = u.config.probabilistic.sampling;
  const temperature =
    options.temperature ??
    (beatType && samplingCfg.beatTemperatures[beatType] !== undefined
      ? samplingCfg.beatTemperatures[beatType]
      : samplingCfg.temperature);

  return sampleCharacterMove(validated, {
    rawProbs,
    mask: combinedMask,
    floor: options.floor ?? samplingCfg.floor,
    temperature,
    reroll: options.reroll,
    scorer: scorerName,
  });
}

export interface SampleBriefsResult {
  outcomes: { brief: CharacterBrief; outcome: SampleOutcome }[];
  logs: SampleRollLog[];
  errors: string[];
}

/**
 * Samples a batch of 3-Move Character Briefs in a single invocation,
 * preserving deterministic per-character seeds and returning all roll logs.
 */
export async function sampleBriefs(
  input: UniverseInput,
  briefs: CharacterBrief[],
  options: SampleBriefOptions = {}
): Promise<SampleBriefsResult> {
  const u = open(input);
  const outcomes: { brief: CharacterBrief; outcome: SampleOutcome }[] = [];
  const logs: SampleRollLog[] = [];
  const errors: string[] = [];

  for (const raw of briefs) {
    const validated = CharacterBriefSchema.parse(raw);
    const outcome = await sampleBrief(u, validated, options);
    outcomes.push({ brief: validated, outcome });
    if (outcome.ok && outcome.log) {
      logs.push(outcome.log);
    } else {
      errors.push(`${validated.character}: ${outcome.error ?? 'Sampling failed.'}`);
    }
  }

  return { outcomes, logs, errors };
}

export interface SceneRunOptions extends SampleBriefOptions {
  povCharacter: string;
  book?: string;
  chapter?: number | string;
  asOf?: string;
  writingGuidePath?: string;
}

export interface SceneRunResult {
  logs: SampleRollLog[];
  bundle?: NarratorHandoffBundle;
  errors: string[];
}

/**
 * Chains `sampleBriefs` -> `composeNarrator` in a single Scene-Mode ensemble
 * invocation, enforcing the POV-locked narrator handoff firewall.
 */
export async function sceneRun(
  input: UniverseInput,
  briefs: CharacterBrief[],
  options: SceneRunOptions
): Promise<SceneRunResult> {
  const u = open(input);
  if (briefs.length === 0) {
    return { logs: [], errors: ['sceneRun requires at least one character brief.'] };
  }
  const sampled = await sampleBriefs(u, briefs, options);
  if (sampled.errors.length > 0) {
    return { logs: sampled.logs, errors: sampled.errors };
  }

  const winningMoves: WinningCharacterMove[] = sampled.outcomes.map(({ brief, outcome }) => ({
    character: brief.character,
    move: outcome.log!.chosenMove,
  }));

  const first = sampled.outcomes[0].brief;
  const composed = composeNarrator(u, {
    book: options.book ?? first.book,
    chapter: options.chapter ?? first.chapter,
    asOf: options.asOf ?? first.asOf,
    povCharacter: options.povCharacter,
    sceneSetup: options.sceneSetup ?? '',
    winningMoves,
    writingGuidePath: options.writingGuidePath,
  });

  return {
    logs: sampled.logs,
    bundle: composed.bundle,
    errors: composed.errors,
  };
}

/** Safely shifts chapter filenames, frontmatter `chapter:` numbers, and `#/### Chapter <Word>` headings. */
export function renumber(input: UniverseInput, options: RenumberOptions): RenumberResult {
  const u = open(input);
  return renumberChapters(u.root, u.engine, options);
}

/** Assembles a POV-locked Single Narrator Pen Handoff bundle. */
export function composeNarrator(
  input: UniverseInput,
  options: Omit<ComposeNarratorOptions, 'projectRoot' | 'ufs'>
): { bundle?: NarratorHandoffBundle; errors: string[] } {
  const u = open(input);
  const writingGuidePath = options.writingGuidePath ?? u.config.probabilistic.review.paths.writingGuide;
  return composeNarratorBundle({
    ...options,
    writingGuidePath,
    projectRoot: u.root,
    ufs: u.engine.ufs,
  });
}

/** Assembles deterministic temporal review slices for the 6-lens review board. Never writes to disk. */
export function reviewSlices(input: UniverseInput, options: BuildReviewSlicesOptions): BuildReviewSlicesResult {
  const u = open(input);
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  return buildReviewSlices(u.root, u.config, u.registry, u.engine, records, options);
}

/** Runs the batched Clef-flash -> Clef 27B probabilistic lint pre-pass for a target chapter. */
export async function reviewPrepass(
  input: UniverseInput,
  options: {
    story: string;
    chapter: number | string;
    flashScorer?: DecisionScorer;
    deepScorer?: DecisionScorer;
    plantedClues?: PlantedClue[];
  }
): Promise<{ result?: ProbabilisticPrepassResult; errors: string[] }> {
  const u = open(input);
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  const { slices, errors } = buildReviewSlices(u.root, u.config, u.registry, u.engine, records, {
    story: options.story,
    chapter: options.chapter,
    lenses: ['backward-short'],
  });
  if (errors.length || slices.length === 0) return { errors };

  const slice = slices[0];
  const storyDir = u.engine
    .getStories()
    .find(
      (s) =>
        path.basename(s).toLowerCase().includes(options.story.toLowerCase()) ||
        getBookKeyFromDir(s) === options.story.toLowerCase()
    );
  const allChapters = storyDir ? u.engine.loadChapters(storyDir) : [];
  const targetIdx = allChapters.findIndex((c) => String(c.chapterNum) === String(options.chapter));
  const ch = targetIdx >= 0 ? allChapters[targetIdx] : undefined;
  if (!ch) return { errors: [`Could not load chapter body for ${options.story} ch ${options.chapter}.`] };

  // Build witness / off-page knowledge check input from compiled scene `participants`
  // (`characters_present`) of prior chapters in the same book.
  const NS = u.config.project.nsid;
  const book = slice.book;
  const sceneParticipantsByChapter = new Map<string, string[]>();
  for (const r of records) {
    if (r.$type !== `${NS}.scene`) continue;
    const m = String(r.id).match(/^scene\.(.+)\.ch(.+)$/);
    if (!m || m[1] !== book) continue;
    sceneParticipantsByChapter.set(m[2], Array.isArray(r.participants) ? r.participants : []);
  }

  const priorChapters: PriorChapterWitnessInfo[] = allChapters.slice(0, targetIdx).map((p) => {
    const compiledParticipants = sceneParticipantsByChapter.get(String(p.chapterNum));
    const participants =
      compiledParticipants ??
      p.charactersPresent
        .map((n) => u.registry.resolve(n, 'character')?.id)
        .filter((id): id is string => Boolean(id));
    return {
      chapterNum: p.chapterNum,
      title: p.title,
      participants,
      body: p.body,
      beatPurpose: p.beatPurpose,
    };
  });

  const targetCharIds = new Set<string>();
  const targetPovId = ch.pov ? (u.registry.resolve(ch.pov, 'character')?.id ?? null) : null;
  if (targetPovId) targetCharIds.add(targetPovId);
  for (const name of ch.charactersPresent) {
    const resolved = u.registry.resolve(name, 'character');
    if (resolved) targetCharIds.add(resolved.id);
  }
  const targetCharacters: TargetCharacterSurface[] = [...targetCharIds].map((id) => {
    const ent = u.registry.getEntity(id);
    const displayName = ent?.displayName ?? id;
    const names = [displayName, ...(ent?.aliases ?? [])];
    return { id, displayName, names };
  });

  const flashScorer =
    options.flashScorer ?? createDecisionScorer(u.config, { provider: u.config.probabilistic.scorer.provider === 'mock' ? 'mock' : 'clef-flash' });
  const deepScorer =
    options.deepScorer ?? (u.config.probabilistic.scorer.provider === 'clef' ? createDecisionScorer(u.config, { provider: 'clef' }) : undefined);

  const result = await runProbabilisticLintPrepass(ch.body, slice, u.config, {
    flashScorer,
    deepScorer,
    plantedClues: options.plantedClues,
    witnessCheck: {
      targetChapterNum: ch.chapterNum,
      targetBody: ch.body,
      targetPovId,
      targetCharacters,
      priorChapters,
    },
  });
  return { result, errors: [] };
}

export {
  PinakesMcpServer,
  type McpMode,
  type McpToolDefinition,
  type McpToolCallResult,
  type McpExtraTool,
  type PinakesMcpServerOptions,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './mcp/server.js';

